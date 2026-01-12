/*
 * OOAPI Documentation Version Handling (British English)
 * ------------------------------------------------------
 * - Short banner messages with the visible version included
 * - Banner is fixed at the top of the viewport
 * - All alignment handled in CSS: no resize/offset logic
 * - Version selector overridden for clean URLs
 */

(function () {
  let VERSIONS = []; // from versions.json

  /**
   * Format folder name (e.g. "v6" -> "v6.0", "v6.1" stays "v6.1").
   */
  function formatVersionLabel(folder) {
    if (!folder) return '';
    return /\./.test(folder) ? folder : folder + '.0';
  }

  /**
   * Determine status for the current version folder based on versions.json.
   * If not found, treat as old.
   */
  function getStatusForVersion(versionFolder) {
    for (let i = 0; i < VERSIONS.length; i++) {
      const v = VERSIONS[i];
      const id = v && v.id ? String(v.id) : '';
      if (id === versionFolder) {
        return v.status || 'old';
      }
    }
    return 'old';
  }

  /**
   * Get current (stable) version id from versions.json.
   */
  function getCurrentVersionId() {
    for (let i = 0; i < VERSIONS.length; i++) {
      const v = VERSIONS[i];
      if (v && v.status === 'current') return v.id;
    }
    return '';
  }

  /**
   * Render banner depending on version.
   * Layout wordt volledig door CSS gedaan.
   */
  function renderBanner() {
    const path = window.location.pathname || '';
    const versionMatch = path.match(/v\d+(\.\d+)?/);
    const banner = document.getElementById('version-banner');

    if (!banner || !versionMatch) return;

    const versionFolder = versionMatch[0];          // bv. "v6" of "v6.0" of "v6.1"
    const versionLabel  = formatVersionLabel(versionFolder);

    const status = getStatusForVersion(versionFolder);
    const currentId = getCurrentVersionId();

    // Current stable → no banner
    if (status === 'current') {
      banner.style.display = 'none';
      document.body.classList.remove('with-banner');
      banner.className = '';
      banner.innerHTML = '';
      return;
    }

    // Beta banner
    if (status === 'beta') {
      banner.className = 'banner-beta';
      banner.innerHTML = `
        <div class="version-banner-inner">
          <strong>OOAPI ${versionLabel} (beta).</strong>
          Latest stable:
          <a href="/${currentId}/">${formatVersionLabel(currentId)}</a>.
        </div>
      `;
      banner.style.display = 'block';
      document.body.classList.add('with-banner');
      return;
    }

    // Old / unknown
    banner.className = 'banner-old';
    banner.innerHTML = `
      <div class="version-banner-inner">
        <strong>OOAPI ${versionLabel} (old).</strong>
        Latest:
        <a href="/${currentId}/">${formatVersionLabel(currentId)}</a>.
      </div>
    `;
    banner.style.display = 'block';
    document.body.classList.add('with-banner');
  }

  /**
   * Override Docsify Versioned Plugin to ensure stable URLs.
   */
  function initialiseVersionSwitch() {
    document.addEventListener(
      'change',
      function (event) {
        const el = event.target;
        if (!el || el.tagName !== 'SELECT') return;

        const folder = (el.value || '').replace(/^\/|\/$/g, '');
        if (!folder) return;

        event.stopImmediatePropagation();

        const hash = window.location.hash || '#/';
        const base = window.location.origin;

        window.location.href =
          base + '/' + folder + '/' + hash.replace(/^#?/, '#');
      },
      true
    );
  }

  function initialise() {
    // kleine delay zodat Docsify de layout klaar heeft
    fetch('/versions.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        VERSIONS = (data && data.versions && Array.isArray(data.versions)) ? data.versions : [];
        setTimeout(renderBanner, 80);
      });

    initialiseVersionSwitch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise);
  } else {
    initialise();
  }
})();
