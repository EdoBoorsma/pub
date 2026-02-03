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
    path: "/api"
  },
  redirects: [{ from: "/", to: "/api" }],
  server: {
    ssr: false
  },
  experimental: {
    ssr: false
  }

};

