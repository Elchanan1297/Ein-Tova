# עין טובה: אימג' אחד. ה־API מגיש גם את אפליקציית Angular (wwwroot).
# בנייה (מתיקיית eintova/):  docker build -t eintova .
# הרצה: ראו docs/deploy.md

# ---------- 1. Angular ----------
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npx ng build --configuration production

# ---------- 2. .NET API ----------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
WORKDIR /src/api
# קודם רק קבצי הפרויקטים: שכבת ה־restore נשמרת במטמון כל עוד התלויות לא השתנו
COPY api/Directory.Build.props api/EinTova.sln ./
COPY api/EinTova.Models/EinTova.Models.csproj EinTova.Models/
COPY api/EinTova.Infrastructure/EinTova.Infrastructure.csproj EinTova.Infrastructure/
COPY api/EinTova.DataAccess/EinTova.DataAccess.csproj EinTova.DataAccess/
COPY api/EinTova.Business/EinTova.Business.csproj EinTova.Business/
COPY api/EinTova.Api/EinTova.Api.csproj EinTova.Api/
RUN dotnet restore EinTova.Api/EinTova.Api.csproj
COPY api/ ./
RUN dotnet publish EinTova.Api/EinTova.Api.csproj -c Release -o /app --no-restore

# ---------- 3. הרצה ----------
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /src/web/dist/eintova-web/browser ./wwwroot

# קבצים שהמנהל מעלה ותמונות "מסע בזמן": בתיקייה /data, שצריכה להיות volume קבוע
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    Media__Root=/data/media \
    Photos__Root=/data/photos
RUN mkdir -p /data/media /data/photos && chown -R $APP_UID /data
VOLUME /data

# בלי root
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "EinTova.Api.dll"]
