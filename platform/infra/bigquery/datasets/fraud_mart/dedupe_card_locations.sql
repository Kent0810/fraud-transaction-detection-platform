SELECT card_id, city, state AS region, zip, lat, long, city_pop
FROM `${raw.dim_card}`
WHERE TRUE
QUALIFY ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY _loaded_at DESC) = 1
