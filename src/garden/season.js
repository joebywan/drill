/**
 * The garden's season, from the real calendar. Pure: the date and the hemisphere come in. Seasons
 * change only the garden's decoration and palette; plants never wilt or die.
 *
 *   SEASONS                         ['spring', 'summer', 'autumn', 'winter']
 *   southern(timeZone) -> boolean   a best guess from an IANA zone; anything unknown is northern,
 *                                   and the ⋯ screen's toggle settles it
 *   season(date, south) -> one of SEASONS, by month: meteorological seasons, flipped south of the equator
 */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

// Zones wholly or mostly south of the equator. Australia/* first, as the brief's default.
// ponytail: a prefix list, not a zone database; the settings toggle covers anything it misses.
const SOUTH = [
  'Australia/', 'Antarctica/', 'Pacific/Auckland', 'Pacific/Chatham', 'Pacific/Fiji', 'Pacific/Tongatapu', 'Pacific/Apia',
  'Pacific/Noumea', 'Pacific/Efate', 'Pacific/Port_Moresby', 'Pacific/Tahiti', 'Pacific/Norfolk', 'Pacific/Easter', 'NZ',
  'America/Argentina/', 'America/Buenos_Aires', 'America/Sao_Paulo', 'America/Santiago', 'America/Montevideo',
  'America/Asuncion', 'America/La_Paz', 'America/Lima', 'Chile/', 'Brazil/East',
  'Africa/Johannesburg', 'Africa/Maputo', 'Africa/Harare', 'Africa/Lusaka', 'Africa/Windhoek', 'Africa/Gaborone',
  'Africa/Maseru', 'Africa/Mbabane', 'Africa/Luanda', 'Africa/Lubumbashi', 'Africa/Blantyre', 'Africa/Dar_es_Salaam',
  'Indian/Antananarivo', 'Indian/Mauritius', 'Indian/Reunion', 'Asia/Jakarta', 'Asia/Dili',
];
export const southern = (timeZone = '') => SOUTH.some((z) => (z.endsWith('/') ? timeZone.startsWith(z) : timeZone === z));

/** `date`'s month as read on the device (local time). December to February is northern winter. */
export function season(date = new Date(), south = false) {
  const quarter = Math.floor(((date.getMonth() + 1) % 12) / 3); // Dec–Feb 0, Mar–May 1, Jun–Aug 2, Sep–Nov 3
  return SEASONS[((south ? quarter + 2 : quarter) + 3) % 4];
}
