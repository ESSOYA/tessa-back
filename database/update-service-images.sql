-- Script pour mettre à jour les services avec les chemins d'images
-- Les images sont dans backend/public/[Nom du Service]/

-- Coupe Femme (id=1)
UPDATE services 
SET image = '/public/Coupe Femme/IMG-20251103-WA0047.jpg'
WHERE id = 1 AND name = 'Coupe Femme';

-- Coupe Homme (id=2)
UPDATE services 
SET image = '/public/Coupe Homme/IMG-20251103-WA0054.jpg'
WHERE id = 2 AND (name = 'coupe Homme' OR name = 'Coupe Homme');

-- Coloration (id=3)
UPDATE services 
SET image = '/public/coloration/IMG-20251103-WA0043.jpg'
WHERE id = 3 AND (name = 'coloration' OR name = 'Coloration');

-- Brushing (id=4) - Note: le nom dans la DB est "Brushimg"
UPDATE services 
SET image = '/public/brushing/IMG-20251114-WA0024.jpg'
WHERE id = 4 AND (name = 'Brushimg' OR name = 'Brushing' OR name = 'brushing');

-- Tresses (id=5)
UPDATE services 
SET image = '/public/Tresses/IMG-20251114-WA0020.jpg'
WHERE id = 5 AND (name = 'Tresses' OR name = 'tresses');

-- Soin Capillaire (id=6) - Note: le dossier a une faute "Soin Capilaire"
UPDATE services 
SET image = '/public/Soin Capilaire/IMG-20251114-WA0041.jpg'
WHERE id = 6 AND (name LIKE '%Soin%Capillaire%' OR name LIKE '%soin%capillaire%');

