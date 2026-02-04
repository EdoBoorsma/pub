export default {
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
  },
  basePath: "/zudoku/dist",
  mode: "standalone"

};

