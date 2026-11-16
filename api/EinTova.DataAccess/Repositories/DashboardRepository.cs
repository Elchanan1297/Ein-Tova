using Dapper;
using EinTova.Models.Dashboard;
using Microsoft.Data.SqlClient;

namespace EinTova.DataAccess.Repositories;

/// <summary>הדשבורדים: התקדמות, דיוק ומהירות לפי שחקן, משפחה ושאלה. סיום המשחק ופרסום</summary>
internal sealed class DashboardRepository(SqlConnection db) : RepositoryBase(db)
{
    /// <summary>includeAll=false: רק מי שהתחיל לשחק (לתצוגה הציבורית)</summary>
    public async Task<DashboardData> GetAsync(bool includeAll)
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.GetDashboard, new { IncludeAll = includeAll }, commandType: Sp);
        var summary = await m.ReadFirstAsync<DashboardSummary>();
        var families = (await m.ReadAsync<DashboardFamily>()).ToList();
        var players = (await m.ReadAsync<DashboardPlayer>()).ToList();
        var questions = (await m.ReadAsync<DashboardQuestion>()).ToList();
        return new DashboardData(summary, families, players, questions);
    }

    public async Task<DashboardCharts> GetChartsAsync()
    {
        using var m = await Db.QueryMultipleAsync(StoredProcedures.GetDashboardCharts, commandType: Sp);
        var general = await m.ReadFirstAsync<ChartsGeneral>();
        var families = (await m.ReadAsync<ChartsFamily>()).ToList();
        var timeline = (await m.ReadAsync<ChartsTimelinePoint>()).ToList();
        var bins = (await m.ReadAsync<ChartsBin>()).ToList();
        var heat = (await m.ReadAsync<ChartsHeatCell>()).ToList();
        var wrong = (await m.ReadAsync<ChartsTopWrong>()).ToList();
        return new DashboardCharts(general, families, timeline, bins, heat, wrong);
    }

    public Task SetPublishedAsync(bool publish) =>
        Db.ExecuteAsync(StoredProcedures.AdminSetResultsPublished, new { Publish = publish }, commandType: Sp);
}
