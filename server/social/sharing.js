import { createCanvas } from 'canvas';

export async function generateShareCard(data) {
  const { playerName, score, league, achievements = [] } = data;
  
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Gradient Border
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f3460');
  grad.addColorStop(1, '#e94560');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Text: Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DFWA BATTLE STATS', width / 2, 100);

  // Text: Player Name
  ctx.font = '40px Arial';
  ctx.fillText(playerName, width / 2, 180);

  // Text: Score & League
  ctx.font = 'bold 80px Arial';
  ctx.fillStyle = '#e94560';
  ctx.fillText(`${score} PTS`, width / 2, 300);
  
  ctx.font = '40px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`LEAGUE: ${league}`, width / 2, 370);

  // Achievements
  if (achievements.length > 0) {
    ctx.font = '30px Arial';
    ctx.fillText('RECENT ACHIEVEMENTS', width / 2, 450);
    ctx.font = '25px Arial';
    ctx.fillStyle = '#00d2ff';
    achievements.slice(0, 3).forEach((ach, i) => {
      ctx.fillText(`★ ${ach}`, width / 2, 500 + (i * 40));
    });
  }

  // Branding
  ctx.font = '20px Arial';
  ctx.fillStyle = '#888888';
  ctx.fillText('play-dfwa.io', width / 2, 590);

  return canvas.toBuffer('image/png');
}
