import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { getSupabaseBackend } from "../src/server/supabaseBackend";
import { resolveDiscordIdentity, SupabaseDiscordIdentitySource } from "../src/server/discordIdentity";
import { AivaDiscordChannel } from "../src/server/aivaDiscordChannel";
import { buildAivaDiscordMessage } from "./presentation";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !applicationId || !guildId) {
  console.error("[AIVA DISCORD] Faltam DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID ou DISCORD_GUILD_ID.");
  process.exit(1);
}

const statusCommand = new SlashCommandBuilder()
  .setName("aiva-status")
  .setDescription("Confirma se a AIVA está online.");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});
let aivaChannel: AivaDiscordChannel | null = null;

async function registerGuildCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: [statusCommand.toJSON()],
  });
  console.log(`[AIVA DISCORD] Comando /aiva-status registado no servidor ${guildId}.`);
}

client.once(Events.ClientReady, async (readyClient) => {
  try {
    const guild = await readyClient.guilds.fetch(guildId);
    console.log(`[AIVA DISCORD] Online como ${readyClient.user.tag} em ${guild.name}.`);
  } catch (error) {
    console.error(`[AIVA DISCORD] O bot ligou, mas não conseguiu aceder ao servidor ${guildId}.`, error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "aiva-status") return;
  try {
    await interaction.reply(buildAivaDiscordMessage("AIVA online.", "Estado do sistema"));
  } catch (error) {
    console.error("[AIVA DISCORD] Erro ao responder a /aiva-status.", error);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !client.user || !message.mentions.users.has(client.user.id)) return;
  try {
    const backend = getSupabaseBackend();
    if (!backend) throw new Error("SUPABASE_NOT_CONFIGURED");
    const identity = await resolveDiscordIdentity(new SupabaseDiscordIdentitySource(backend.client), message.author.id);
    if (!identity) {
      await message.reply(buildAivaDiscordMessage("A tua conta Discord ainda não está associada a um perfil AXION.", "Associação necessária"));
      return;
    }
    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    if (!prompt) {
      await message.reply(buildAivaDiscordMessage("Diga-me como posso ajudar."));
      return;
    }
    await message.channel.sendTyping();
    aivaChannel ||= AivaDiscordChannel.fromEnvironment(backend.client);
    const conversationKey = `${message.guildId || "dm"}:${message.channelId}:${message.author.id}`;
    const response = await aivaChannel.respond(conversationKey, identity.userId, prompt);
    await message.reply(buildAivaDiscordMessage(response));
  } catch (error) {
    console.error("[AIVA DISCORD] Erro ao processar a mensagem com a AIVA Core.", error);
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"));
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const quotaExhausted = code === "credit_balance_exhausted" || code === "insufficient_quota";
    const errorText = quotaExhausted
      ? "O projeto OpenAI associado à AIVA está sem créditos API. Adicione saldo ao projeto para voltar a utilizar a AIVA no Discord."
      : timedOut
        ? "A AIVA demorou demasiado a responder. Tente novamente."
        : "Não foi possível obter uma resposta da AIVA neste momento.";
    await message.reply(buildAivaDiscordMessage(errorText, quotaExhausted ? "Créditos API esgotados" : "Erro temporário")).catch(() => undefined);
  }
});

client.on(Events.Error, (error) => {
  console.error("[AIVA DISCORD] Erro do cliente.", error);
});

client.on(Events.Warn, (warning) => {
  console.warn("[AIVA DISCORD] Aviso do cliente:", warning);
});

client.on(Events.ShardError, (error, shardId) => {
  console.error(`[AIVA DISCORD] Erro de ligação no shard ${shardId}. O cliente tentará restabelecer a ligação.`, error);
});

client.on(Events.ShardDisconnect, (_event, shardId) => {
  console.warn(`[AIVA DISCORD] Shard ${shardId} desligado.`);
});

client.on(Events.ShardReconnecting, (shardId) => {
  console.log(`[AIVA DISCORD] A restabelecer a ligação do shard ${shardId}...`);
});

process.on("unhandledRejection", (error) => {
  console.error("[AIVA DISCORD] Promise rejeitada sem tratamento.", error);
});

async function shutdown(signal: string) {
  console.log(`[AIVA DISCORD] ${signal} recebido. A desligar.`);
  client.destroy();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function start() {
  try {
    await registerGuildCommands();
    await client.login(token);
  } catch (error) {
    console.error("[AIVA DISCORD] Não foi possível iniciar o bot.", error);
    client.destroy();
    process.exitCode = 1;
  }
}

void start();
