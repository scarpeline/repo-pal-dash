-- Atualizando o pacote Start 2
UPDATE packages 
SET checkout_url = 'https://www.asaas.com/c/kt6lffsnpy43hsrb',
    asaas_payment_link_id = 'kt6lffsnpy43hsrb'
WHERE name ILIKE '%Start 2%';

-- Atualizando o pacote Starter
UPDATE packages 
SET checkout_url = 'https://www.asaas.com/c/77j81o6lsyklrjq7',
    asaas_payment_link_id = '77j81o6lsyklrjq7'
WHERE name ILIKE '%Starter%';

-- Atualizando o pacote Dedicado
UPDATE packages 
SET checkout_url = 'https://www.asaas.com/c/s3oeukw6mxg4zqy6',
    asaas_payment_link_id = 's3oeukw6mxg4zqy6'
WHERE name ILIKE '%Dedicado%';
