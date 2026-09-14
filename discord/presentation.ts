import { fileURLToPath } from "node:url";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";

const AXION_COLOR = 0x00f0ff;
const LOGO_NAME = "aiva-axion-logo.png";
const LOGO_PATH = fileURLToPath(new URL("../assets/logo.png", import.meta.url));

export function buildAivaDiscordMessage(text: string, title = "AIVA") {
  const logo = new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME, description: "Logótipo AXION" });
  const embed = new EmbedBuilder()
    .setColor(AXION_COLOR)
    .setAuthor({ name: "AIVA · AXION OFFICE", iconURL: `attachment://${LOGO_NAME}` })
    .setTitle(title)
    .setDescription(text.slice(0, 4_096))
    .setThumbnail(`attachment://${LOGO_NAME}`)
    .setFooter({ text: "AXION Intelligent Virtual Assistant" })
    .setTimestamp();
  return { embeds: [embed], files: [logo], allowedMentions: { repliedUser: false } };
}
