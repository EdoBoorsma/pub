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
    },
    transformExamples: ({ content, operation }) => {
      return content.map((contentItem) => {
        // Als er geen example is, genereer dan een uit het schema
        if (!contentItem.example && !contentItem.examples && contentItem.schema) {
          try {
            contentItem.example = generateExampleFromSchema(contentItem.schema);
          } catch (error) {
            console.warn(`Could not generate example for ${operation.operationId}:`, error);
          }
        }
        return contentItem;
      });
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



/* ===== Zudoku injected MODEL operations (zudoku-model-for-*) ===== */



/* Hide nav items for injected model pages */
a[data-anchor^="zudoku-model-for-"] {
  display: none !important;
}
ul:has(> a[data-anchor^="zudoku-model-for-"]:only-child) {
  display: none !important;
}



/* Hide the injected operation title + method/path line */
.grid:has(h2[id^="zudoku-model-for-"]) > h2[id^="zudoku-model-for-"] {
  display: none !important;
}
.grid:has(h2[id^="zudoku-model-for-"]) > h2[id^="zudoku-model-for-"] + div {
  display: none !important;
}



/* Hide only the request/cURL sidecar (first box), keep Example Responses on the right */
.grid:has(h2[id^="zudoku-model-for-"])
  aside > div[data-slot="sidecar-box-root"]:first-of-type {
  display: none !important;
}



/* Hide the "Documentation only..." prose block on the left */
.grid:has(h2[id^="zudoku-model-for-"])
  .flex.flex-col.gap-4:has(> .prose) > .prose {
  display: none !important;
}



/* Hide the top response header area that contains "200 OK" and the grey summary text.
   Keep the actual schema/properties block (frame-panel) intact. */
.grid:has(h2[id^="zudoku-model-for-"])
  div[data-slot="frame"] > div.flex.flex-col.text-muted-foreground {
  display: none !important;
}
/* Verberg chevron voor tags die eindigen op -model */
a[href$="-model"] > div > button,
a[href$="-model/"] > div > button {
  display: none !important;
}


`
  },
};

function generateExampleFromSchema(schema) {
  if (!schema) return null;
  
  // Als er al een example op schema niveau is, gebruik die
  if (schema.example !== undefined) {
    return schema.example;
  }
  
  // Handle arrays
  if (schema.type === 'array') {
    if (schema.items) {
      const itemExample = generateExampleFromSchema(schema.items);
      return itemExample ? [itemExample] : [];
    }
    return [];
  }
  
  // Handle objects
  if (schema.type === 'object' || schema.properties) {
    const example = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const value = generateExampleFromSchema(prop);
        if (value !== null) {
          example[key] = value;
        }
      }
    }
    
    return Object.keys(example).length > 0 ? example : null;
  }
  
  // Handle primitives met example
  if (schema.example !== undefined) {
    return schema.example;
  }
  
  // Handle enums
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  
  // Handle defaults
  if (schema.default !== undefined) {
    return schema.default;
  }
  
  // Fallback op basis van type
  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? '2024-01-01T00:00:00Z' :
             schema.format === 'date' ? '2024-01-01' :
             schema.format === 'email' ? 'user@example.com' :
             schema.format === 'uri' ? 'https://example.com' :
             'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}
