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
      
      /* Algemene regels voor ALLE geïnjecteerde schemas
         Detectie: pagina's die zowel h1#description ALS schemadefinition hebben */
      
      /* Verberg "Endpoint" regel op schema pages */
      div.mb-8:has(h1#description):has(schemadefinition) div.flex.items-center.gap-1\\.5.flex-nowrap {
        display: none !important;
      }
      
      /* Verberg schemadefinition divs */
      div.prose:has(schemadefinition) {
        display: none !important;
      }
      
      /* Verberg h2 titles op schema pages (detecteer via grid met schemadefinition in parent) */
      .grid:has(div.mb-8 schemadefinition) > h2 {
        display: none !important;
      }
      
      /* Verberg GET badge en path op schema pages */
      .grid:has(div.mb-8 schemadefinition) > div.text-sm.flex.gap-2.font-mono.col-span-full {
        display: none !important;
      }
      
      /* Verberg eerste separator op schema pages */
      .grid:has(div.mb-8 schemadefinition) > div.flex.flex-col.gap-4 > div[data-slot="separator"]:first-child {
        display: none !important;
      }
      
      /* Verberg "Responses" h3 heading op schema pages */
      .grid:has(div.mb-8 schemadefinition) h3[id$="/responses"] {
        display: none !important;
      }
      
      /* Verberg "200" badge en description header */
      .grid:has(div.mb-8 schemadefinition) h3[id$="/responses"] + div [data-slot="badge"],
      .grid:has(div.mb-8 schemadefinition) h3[id$="/responses"] + div header[data-slot="frame-panel-header"] {
        display: none !important;
      }
      
      /* Verberg ALLEEN de eerste sidecar-box (cURL) op schema pages */
      .grid:has(div.mb-8 schemadefinition) > aside > [data-slot="sidecar-box-root"]:first-of-type {
        display: none !important;
      }
    `
  },
};
