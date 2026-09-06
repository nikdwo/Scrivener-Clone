import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/ui',timeout:60000,use:{browserName:'chromium',channel:'msedge',headless:true,viewport:{width:1460,height:900}},webServer:{command:'node scripts/test-server.mjs',url:'http://127.0.0.1:4177',reuseExistingServer:false},reporter:'list'});
