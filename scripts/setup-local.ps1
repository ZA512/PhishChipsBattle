param([ValidateRange(1024,65535)][int]$Port=8080)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskEnvFile=Join-Path $taskRoot '.env'
if(Test-Path -LiteralPath $taskEnvFile) {throw '.env existe déjà : conservez-le ou modifiez-le explicitement.'}
function New-LocalSecret([int]$Size) {
    $taskBytes=New-Object byte[] $Size
    $taskRng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {$taskRng.GetBytes($taskBytes)} finally {$taskRng.Dispose()}
    return [BitConverter]::ToString($taskBytes).Replace('-','').ToLowerInvariant()
}
$taskLines=@(
    'POSTGRES_DB=phishchips','POSTGRES_USER=phishchips',
    "POSTGRES_PASSWORD=$(New-LocalSecret 24)","JWT_SECRET=$(New-LocalSecret 48)","ADMIN_PASSWORD=$(New-LocalSecret 24)",
    'AUTH_MODE=local',"APP_URL=http://localhost:$Port","FRONTEND_PORT=$Port",'FRONTEND_BIND_IP=127.0.0.1',
    'ENTRA_TENANT_ID=','ENTRA_CLIENT_ID=','ENTRA_CLIENT_SECRET=','CORS_ORIGIN=',
    'TRUST_PROXY=loopback,linklocal,uniquelocal'
)
[System.IO.File]::WriteAllLines($taskEnvFile,$taskLines,[System.Text.UTF8Encoding]::new($false))
Write-Output ".env créé pour http://localhost:$Port avec des secrets aléatoires. Lancez docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait."
Write-Output 'Le secret ADMIN_PASSWORD sert à créer le premier administrateur depuis la page de connexion.'
