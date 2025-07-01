module.exports = {
  apps: [{
    name: "blocks-supplier",
    script: "./server.js",  // Make sure this path is correct!
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: "production",
      MONGO_URI: "mongodb+srv://ogwuawuri:abraham1000@cluster0.xqr23zx.mongodb.net/blocks-supplier?retryWrites=true&w=majority&appName=Cluster0"
    }
  }]
};