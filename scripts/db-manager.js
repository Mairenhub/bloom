#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'videos.db');
const db = new Database(dbPath);

console.log('🗄️ Video Database Manager');
console.log('Database location:', dbPath);
console.log('');

// List all videos
function listVideos() {
  console.log('📋 All Videos:');
  console.log('==============');
  
  const videos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
  
  if (videos.length === 0) {
    console.log('No videos found.');
    return;
  }
  
  videos.forEach((video, index) => {
    console.log(`${index + 1}. Task ID: ${video.task_id}`);
    console.log(`   Frame ID: ${video.frame_id}`);
    console.log(`   Status: ${video.status}`);
    console.log(`   Created: ${video.created_at}`);
    if (video.video_url) {
      console.log(`   Video URL: ${video.video_url}`);
    }
    if (video.error_message) {
      console.log(`   Error: ${video.error_message}`);
    }
    console.log('');
  });
}

// Clear all videos
function clearVideos() {
  const result = db.prepare('DELETE FROM videos').run();
  console.log(`🗑️ Cleared ${result.changes} videos from database.`);
}

// Show database stats
function showStats() {
  const totalVideos = db.prepare('SELECT COUNT(*) as count FROM videos').get();
  const successfulVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'succeed'").get();
  const failedVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status = 'failed'").get();
  const processingVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE status IN ('submitted', 'processing')").get();
  
  console.log('📊 Database Statistics:');
  console.log('======================');
  console.log(`Total videos: ${totalVideos.count}`);
  console.log(`Successful: ${successfulVideos.count}`);
  console.log(`Failed: ${failedVideos.count}`);
  console.log(`Processing: ${processingVideos.count}`);
  console.log('');
}

// Main command handling
const command = process.argv[2];

switch (command) {
  case 'list':
  case 'ls':
    listVideos();
    break;
  case 'clear':
  case 'clean':
    clearVideos();
    break;
  case 'stats':
    showStats();
    break;
  default:
    console.log('Usage: node scripts/db-manager.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  list, ls    - List all videos');
    console.log('  clear, clean - Clear all videos');
    console.log('  stats       - Show database statistics');
    console.log('');
}

db.close();
