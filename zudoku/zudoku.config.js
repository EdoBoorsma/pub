export default {

  basePath: "/zudoku/dist",

  prerender: false,

  build: {
    outDir: "../.."  // Absoluut pad vanaf waar config staat?
  },
 
  navigation: [
    {
      type: "link",
      to: "api",
      label: "API Reference"
    }
  ],
  
  apis: {
    type: "file",
    input: "../ooapi.zudoku.json",
    path: "api"
  }
};
