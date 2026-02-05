export default {
  basePath: "/zudoku/dist",
  prerender: false,
  build: {
    outDir: "../.."
  },
  navigation: [
    { type: "link", to: "api", label: "API Reference" }
  ],
  apis: {
    type: "file",
    input: "../ooapi.zudoku.json",
    path: "api",
    options: {
      expandAllTags: false
    }
  },
  theme: {
    customCss: `
      /* Verberg zudoku-placeholder elementen */
      h2[id^="zudoku-placeholder"] {
        display: none !important;
      }
      
      .grid.grid-cols-1.lg\\:grid-cols-\\[minmax\\(0\\,4fr\\)_minmax\\(0\\,3fr\\)\\]:has(h2[id^="zudoku-placeholder"]) {
        display: none !important;
      }
      
      .grid.grid-cols-1.lg\\:grid-cols-\\[minmax\\(0\\,4fr\\)_minmax\\(0\\,3fr\\)\\]:has(h2[id^="zudoku-placeholder"]) + hr {
        display: none !important;
      }
      
      a[data-anchor^="zudoku-placeholder"] {
        display: none !important;
      }
      
      ul:has(> a[data-anchor^="zudoku-placeholder"]:only-child) {
        display: none !important;
      }
      
      /* ========================================
         GENERIEKE REGELS VOOR ALLE SCHEMAS
         Detectie: gebruik body class of check of er een h1#description bestaat
         ======================================== */
      
      /* Schema pages hebben h1#description in een sibling div.mb-8 */
      /* Target de parent container die beide bevat */
      
      /* Verberg h2 title op schema pages */
      body:has(h1#description) .grid > h2 {
        display: none !important;
      }
      
      /* Verberg GET badge en /_models/XXX path op schema pages */
      body:has(h1#description) .grid > div.text-sm.flex.gap-2.font-mono.col-span-full {
        display: none !important;
      }
      
      /* Verberg eerste separator op schema pages */
      body:has(h1#description) .grid > div.flex.flex-col.gap-4 > div[data-slot="separator"]:first-child {
        display: none !important;
      }
      
      /* Verberg "Responses" h3 heading ALLEEN op schema pages */
      body:has(h1#description) .grid h3[id$="/responses"] {
        display: none !important;
      }
      
      /* Verberg "200" badge en description header ALLEEN op schema pages */
      body:has(h1#description) .grid h3[id$="/responses"] + div [data-slot="badge"],
      body:has(h1#description) .grid h3[id$="/responses"] + div header[data-slot="frame-panel-header"] {
        display: none !important;
      }
      
      /* Verberg cURL box ALLEEN op schema pages */
      body:has(h1#description) .grid > aside > [data-slot="sidecar-box-root"]:first-of-type {
        display: none !important;
      }
      
      /* Verberg "Endpoint" regel op schema pages */
      div.mb-8:has(h1#description) div.flex.items-center.gap-1\\.5.flex-nowrap {
        display: none !important;
      }
      
      /* Verberg schemadefinition div */
      div.prose:has(schemadefinition) {
        display: none !important;
      }
    `
  },
};
