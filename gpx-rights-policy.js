(function(root){
  const PROCESS_ACTIONS = [
    "gpxFileFetch",
    "gpxFileImport",
    "gpxFileProcess",
    "gpxFileStore",
    "gpxFileMapDisplay"
  ];
  const PERMISSION_KEYS = [
    "officialDescriptionVerbatim",
    "editedDescription",
    "originalSummary",
    "routeFacts",
    "mapsAndRouteLines",
    "elevationProfiles",
    "gpxFileFetch",
    "gpxFileImport",
    "gpxFileStore",
    "gpxFileProcess",
    "gpxFileMapDisplay",
    "gpxFileUserDownload",
    "gpxOfficialLink",
    "eventNamesAndMarks",
    "logosAndWordImageMarks",
    "symbolsIconsPictogramsEmblemsMascots",
    "eventSpecificGraphics"
  ];
  function defaultEntry(extra){
    const permissions = {};
    PERMISSION_KEYS.forEach(key => { permissions[key] = false; });
    return Object.assign({
      status: "pending",
      permissions,
      restriction: {
        status: "not_checked",
        notice: null,
        sourceUrl: null,
        checkedAt: null,
        downloadPageChecked: false,
        metadataChecked: false,
        metadataStatus: "not_available",
        linkStatus: "not_checked"
      }
    }, extra || {});
  }
  function reviewed(entry){
    return !!entry && (entry.status === "approved" || entry.status === "partial");
  }
  function allows(entry, action){
    if (!reviewed(entry) || !entry.permissions || entry.permissions[action] !== true) return false;
    const restrictionStatus = entry.restriction && entry.restriction.status || "not_checked";
    if (action === "gpxOfficialLink") return restrictionStatus === "clear" || (entry.restriction && entry.restriction.linkStatus === "allowed");
    return restrictionStatus === "clear";
  }
  function canProcess(entry){
    return PROCESS_ACTIONS.every(action => allows(entry, action));
  }
  function canDownload(entry){
    return allows(entry, "gpxFileUserDownload");
  }
  function canLink(entry){
    return allows(entry, "gpxOfficialLink");
  }
  function isDirectFileUrl(url){
    const value = String(url || "");
    return /\.gpx(?:$|[?#])/i.test(value) || /drive\.google\.com\/(?:file\/d\/|uc\?export=download)/i.test(value);
  }
  function shouldBlockFetch(url, entry, knownRouteGpx){
    if (!isDirectFileUrl(url) && !knownRouteGpx) return false;
    return !canProcess(entry);
  }
  root.GpxRightsPolicy = Object.freeze({
    PROCESS_ACTIONS,
    PERMISSION_KEYS,
    defaultEntry,
    allows,
    canProcess,
    canDownload,
    canLink,
    isDirectFileUrl,
    shouldBlockFetch
  });
  if (typeof module !== "undefined" && module.exports) module.exports = root.GpxRightsPolicy;
})(typeof window !== "undefined" ? window : globalThis);
