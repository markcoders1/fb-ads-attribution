const { nullableString } = require("./nullable");
const DEFAULT_GRAPH_VERSION = process.env.GRAPH_API_VERSION;

/**
 * @returns {Promise<{ campaign_id: string | null, adset_id: string | null }>}
 */
async function fetchCampaignAndAdsetFromAdId(adId, accessToken, apiVersion = DEFAULT_GRAPH_VERSION) {
  if (!adId || !accessToken) {
    return { campaign_id: null, adset_id: null };
  }
  console.log("META Marketing fetchCampaignAndAdsetFromAdId", adId, accessToken, apiVersion);
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(String(adId))}`);
  url.searchParams.set('fields', 'campaign{id},adset{id}');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    console.error('[Meta Marketing] Graph error for ad', adId, data);
    return { campaign_id: null, adset_id: null };
  }
  return {
    campaign_id: nullableString(data.campaign?.id),
    adset_id: nullableString(data.adset?.id),
  };
}

module.exports = {
  fetchCampaignAndAdsetFromAdId,
};
