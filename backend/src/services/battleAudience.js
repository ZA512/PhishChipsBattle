"use strict";
// Call with the battle locked. ON CONFLICT preserves every existing roster snapshot.
async function enrollEligible(client, battle) {
  if (
    battle.status !== "published" ||
    battle.audience_mode === "snapshot" ||
    (battle.ends_at &&
      new Date(battle.ends_at) <= new Date(battle.server_now || Date.now()))
  )
    return;
  await client.query(
    `INSERT INTO battle_participants(battle_id,player_id,employee_id,name,service_id,service_name)
    SELECT $1,p.id,p.directory_id,COALESCE(d.display_name,p.name),s.id,s.name
    FROM players p LEFT JOIN directory_employees d ON d.id=p.directory_id
    JOIN services s ON s.id=p.service_id AND s.archived_at IS NULL
    WHERE (d.id IS NULL OR d.active) AND ($2::text='all' OR p.service_id=ANY($3::int[]))
    ON CONFLICT DO NOTHING`,
    [battle.id, battle.audience_mode, battle.audience_team_ids],
  );
}
async function refreshAudiences(client) {
  const { rows } =
    await client.query(`SELECT *,clock_timestamp() AS server_now FROM battles
    WHERE status='published' AND audience_mode<>'snapshot' AND (ends_at IS NULL OR ends_at>clock_timestamp())
    ORDER BY id FOR SHARE`);
  for (const battle of rows) await enrollEligible(client, battle);
}
module.exports = { enrollEligible, refreshAudiences };
