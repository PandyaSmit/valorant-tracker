const express = require("express");
const serverless = require("serverless-http");
const dotenv = require("dotenv");
const HenrikDevValorantAPI = require("unofficial-valorant-api");
const _ = require("lodash");
const VAPI = new HenrikDevValorantAPI();

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const { Client, IntentsBitField, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const getDetails = async (userName, tag) => {
  try {
    const mmr_data = await VAPI.getMatches({
      version: "v3",
      region: "ap",
      name: userName,
      tag: tag,
    });

    if (mmr_data.error) {
      throw mmr_data.error;
    }

    const lastPlayedMatch = mmr_data.data[0];
    const allPlayers = lastPlayedMatch.players.all_players;
    const currentPlayerTeam = _.lowerCase(
      _.find(allPlayers, ["name", userName])?.team
    );

    const details = {
      metadata: lastPlayedMatch.metadata,
      players: allPlayers,
      status: lastPlayedMatch.teams[currentPlayerTeam],
    };

    return details;
  } catch (error) {
    throw error;
  }
};

const detailsSummary = (details, username) => {
  const player = _.find(details.players, ["name", username]);

  const message = `Last played on: ${
    details.metadata.game_start_patched
  }\nMap: ${details.metadata.map}\nMode: ${details.metadata.mode}\nStatus: ${
    details.status.has_won ? "won" : "lost"
  }\nKDA: ${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`;

  return {
    message,
    files: player.assets.card.small,
  };
};

app.post("/last-match/info/:username/:tag", async (req, res) => {
  try {
    const details = await getDetails(req.params.username, req.params.tag);
    return res.send(details).status(200);
  } catch (error) {
    console.error(error);
    return res.send(error).status(500);
  }
});

module.exports.handler = serverless(app);

module.exports.local = () =>
  app.listen(3000, () => console.log(`Listening on: 3000`));

const token = process.env.DISCORD_TOKEN || "";

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (msg) => {
  if (msg.content.includes("username:")) {
    try {
      const messageChannel = msg.content.replace("username:", "");
      const userDetails = messageChannel.split("#");
      const details = await getDetails(userDetails[0], userDetails[1]);
      const response = detailsSummary(details, userDetails[0]);
      msg.reply({ content: response.message, files: [response.files] });
    } catch (error) {
      msg.reply(error);
    }
  }
});

client.login(token);
