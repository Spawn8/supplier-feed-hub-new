-- Test if the columns exist in the suppliers table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
AND column_name LIKE '%sync%' OR column_name LIKE '%creation%'
ORDER BY column_name;
