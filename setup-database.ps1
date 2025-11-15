# Script PowerShell pour creer la base de donnees
Write-Host "Configuration de la base de donnees salon_coiffure..." -ForegroundColor Green

# Chemin vers MySQL
$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"
$sqlFile = "database\schema.sql"

# Verifier si MySQL existe
if (Test-Path $mysqlPath) {
    Write-Host "MySQL trouve a: $mysqlPath" -ForegroundColor Green
    
    # Executer le script SQL
    Write-Host "Creation de la base de donnees..." -ForegroundColor Yellow
    & $mysqlPath -u root -e "source $sqlFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Base de donnees creee avec succes !" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de la creation de la base de donnees" -ForegroundColor Red
    }
} else {
    Write-Host "MySQL non trouve a: $mysqlPath" -ForegroundColor Red
    Write-Host "Assurez-vous que XAMPP est installe et que MySQL est demarre" -ForegroundColor Yellow
}

Write-Host "Vous pouvez maintenant demarrer le serveur avec: npm run dev" -ForegroundColor Green