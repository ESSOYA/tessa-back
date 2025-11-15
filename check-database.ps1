# Script pour verifier les donnees de la base
Write-Host "Verification de la base de donnees..." -ForegroundColor Green

$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"

# Verifier les utilisateurs
Write-Host "`nUtilisateurs dans la base:" -ForegroundColor Yellow
& $mysqlPath -u root -e "USE salon_coiffure; SELECT id, email, first_name, last_name, role_id FROM users;"

# Verifier les services
Write-Host "`nServices dans la base:" -ForegroundColor Yellow
& $mysqlPath -u root -e "USE salon_coiffure; SELECT id, name, price FROM services;"

# Verifier les roles
Write-Host "`nRoles dans la base:" -ForegroundColor Yellow
& $mysqlPath -u root -e "USE salon_coiffure; SELECT * FROM roles;"

Write-Host "`nVerification terminee!" -ForegroundColor Green

