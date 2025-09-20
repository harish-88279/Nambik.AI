import { query, initializeDatabase, closeConnections } from '../database/connection';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface Link {
  link: string;
  language: string;
  mood: string;
}

const getYouTubeVideoId = (url: string) => {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('v');
};

const seedResources = async () => {
  try {
    await initializeDatabase();

    const linksPath = path.resolve(__dirname, '..', '..', '..', 'database', 'links.json');
    const linksData = fs.readFileSync(linksPath, 'utf-8');
    const links: Link[] = JSON.parse(linksData);
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY not found in .env file');
    }

    for (const link of links) {
      const videoId = getYouTubeVideoId(link.link);
      if (videoId) {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet`);
        const video = response.data.items[0];
        if (video) {
          const { title, description, thumbnails } = video.snippet;
          const thumbnailUrl = thumbnails.high.url;

          await query(
            `INSERT INTO resources (title, description, resource_type, file_url, thumbnail_url, language, tags, is_published) 
             VALUES ($1, $2, 'video', $3, $4, $5, ARRAY[$6], true) ON CONFLICT (file_url) DO NOTHING`,
            [title, description, link.link, thumbnailUrl, link.language, link.mood]
          );
        }
      }
    }

    logger.info('Successfully seeded resources from links.json');
  } catch (error) {
    logger.error('Error seeding resources:', error);
  } finally {
    await closeConnections();
  }
};

seedResources();
