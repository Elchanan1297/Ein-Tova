using System.Data;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cs = builder.Configuration.GetConnectionString("Db")!;
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!));

builder.Services.AddScoped(_ => new SqlConnection(cs));
builder.Services.AddMemoryCache();
builder.Services.AddSignalR();
builder.Services.AddSingleton<ShowState>();
builder.Services.AddHostedService<LeaderboardPusher>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    // SignalR ב־WebSocket לא שולח כותרות: הטוקן מגיע ב־query string, רק ל־/hubs
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = c =>
        {
            if (c.Request.Path.StartsWithSegments("/hubs")) c.Token = c.Request.Query["access_token"];
            return Task.CompletedTask;
        }
    };
    o.TokenValidationParameters = new TokenValidationParameters
    {
        IssuerSigningKey = key, ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true
    };
});
builder.Services.AddAuthorization(o =>
{
    // טוקן של מוזמן (gid) וטוקן של מנהל (role=admin) לא מחליפים זה את זה
    o.AddPolicy("guest", p => p.RequireClaim("gid"));
    o.AddPolicy("admin", p => p.RequireClaim("role", "admin"));
});
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    // מגבלה נדיבה: כל האורחים באולם יושבים מאחורי אותה כתובת IP
    o.AddFixedWindowLimiter("login", c => { c.PermitLimit = 60; c.Window = TimeSpan.FromMinutes(1); c.QueueLimit = 0; });
    o.AddFixedWindowLimiter("admin-login", c => { c.PermitLimit = 10; c.Window = TimeSpan.FromMinutes(1); c.QueueLimit = 0; });
});
// קבצים שהמנהל מעלה. בייצור: Media__Root לתיקייה קבועה (volume / /home ב־Azure)
var mediaRoot = builder.Configuration["Media:Root"] ?? Path.Combine(builder.Environment.ContentRootPath, "media");
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMedia(mediaRoot);
app.UseDefaultFiles();
app.UseStaticFiles();   // בהמשך: האפליקציה של Angular תשב ב־wwwroot

string Jwt(Claim claim, TimeSpan life) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
{
    Subject = new ClaimsIdentity(new[] { claim }),
    Expires = DateTime.UtcNow.Add(life),
    SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
});
string Token(int guestId) => Jwt(new Claim("gid", guestId.ToString()), TimeSpan.FromDays(3));
int Gid(ClaimsPrincipal u) => int.Parse(u.FindFirst("gid")!.Value);
var sp = CommandType.StoredProcedure;

// ---------- ציבורי ----------
app.MapGet("/api/config", async (SqlConnection db) =>
    Results.Ok(await db.QueryFirstAsync("usp_GetPublicConfig", commandType: sp)));

// מטמון קצר: כל הטלפונים באולם מרעננים את הלוח כל כמה שניות
app.MapGet("/api/leaderboard", async (SqlConnection db, IMemoryCache cache) =>
    Results.Ok(await Leaderboard.Get(db, cache)));

// תוכן שמשתנה רק מהניהול: מטמון של 30 שניות
app.MapGet("/api/program", async (SqlConnection db, IMemoryCache cache) =>
    Results.Ok(await cache.GetOrCreateAsync("program", async e =>
    {
        e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
        return (await db.QueryAsync("usp_GetProgram", commandType: sp)).ToList();
    })));

// ברכות (תמונות משפחתיות) רק למוזמנים מחוברים
app.MapGet("/api/greetings", async (SqlConnection db, IMemoryCache cache) =>
    Results.Ok(await cache.GetOrCreateAsync("greetings", async e =>
    {
        e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
        return (await db.QueryAsync("usp_GetGreetings", commandType: sp)).ToList();
    }))).RequireAuthorization("guest");

app.MapPost("/api/login/code", async (LoginCode req, SqlConnection db) =>
{
    var g = await db.QuerySingleOrDefaultAsync<GuestDto>("usp_LoginByCode", new { req.Code }, commandType: sp);
    return g is null ? Results.Unauthorized() : Results.Ok(new { token = Token(g.GuestId), guest = g });
}).RequireRateLimiting("login");

app.MapPost("/api/login/phone", async (LoginPhone req, SqlConnection db) =>
{
    var g = await db.QuerySingleOrDefaultAsync<GuestDto>("usp_LoginByPhone", new { req.Phone }, commandType: sp);
    return g is null ? Results.Unauthorized() : Results.Ok(new { token = Token(g.GuestId), guest = g });
}).RequireRateLimiting("login");

// ---------- משחק (דורש התחברות) ----------
var game = app.MapGroup("/api/game").RequireAuthorization("guest");

game.MapPost("/start", async (ClaimsPrincipal u, SqlConnection db) =>
    Results.Ok(await db.QueryFirstAsync("usp_StartAttempt", new { GuestId = Gid(u) }, commandType: sp)));

game.MapGet("/next", async (ClaimsPrincipal u, SqlConnection db) =>
{
    using var m = await db.QueryMultipleAsync("usp_NextQuestion", new { GuestId = Gid(u) }, commandType: sp);
    var head = await m.ReadFirstAsync();
    if ((string)head.Status != "InProgress") return Results.Ok(new { head, options = Array.Empty<object>() });
    var options = (await m.ReadAsync()).ToList();
    return Results.Ok(new { head, options });
});

game.MapPost("/answer", async (AnswerReq r, ClaimsPrincipal u, SqlConnection db) =>
    Results.Ok(await db.QueryFirstAsync("usp_SubmitAnswer", new { GuestId = Gid(u), r.OptionId }, commandType: sp)));

game.MapPost("/timeout", async (ClaimsPrincipal u, SqlConnection db) =>
    Results.Ok(await db.QueryFirstAsync("usp_TimeoutQuestion", new { GuestId = Gid(u) }, commandType: sp)));

game.MapGet("/voice/{eventType}", async (string eventType, SqlConnection db) =>
{
    string[] allowed = { "Welcome", "GameStart", "Correct", "Incorrect", "GameEnd", "Winner" };
    if (!allowed.Contains(eventType)) return Results.BadRequest();
    var clip = await db.QueryFirstOrDefaultAsync("usp_GetVoiceClip", new { EventType = eventType }, commandType: sp);
    return clip is null ? Results.NoContent() : Results.Ok(clip);
});

app.MapAdmin(builder.Configuration["Admin:Password"], () => Jwt(new Claim("role", "admin"), TimeSpan.FromHours(12)), mediaRoot);

app.MapShow();

app.MapFallbackToFile("index.html");
app.Run();

class GuestDto
{
    public int GuestId { get; set; }
    public string FullName { get; set; } = "";
    public int FamilyId { get; set; }
    public string FamilyName { get; set; } = "";
    public string? Code { get; set; }
}
record LoginCode(string Code);
record LoginPhone(string Phone);
record AnswerReq(int OptionId);
