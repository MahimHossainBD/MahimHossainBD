services:
  - type: web
    name: mahimhossainbd-service
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
