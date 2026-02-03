export default {
  navigation: [
    {
      type: "link",
      to: "api",
      label: "API Reference"
    }
  ],
  apis: {
    type: "url",
    input: "./openapi.yaml",
    path: "/api"
  }
}
