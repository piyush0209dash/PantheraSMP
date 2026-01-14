require("dotenv").config()

const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const pvp = require("mineflayer-pvp").plugin
const autoeat = require("mineflayer-auto-eat").plugin
const collectBlock = require("mineflayer-collectblock").plugin
const toolPlugin = require("mineflayer-tool").plugin
const express = require("express")
const { OpenAI } = require("openai")

/* ================= ENV ================= */
const HOST = process.env.SERVER_IP
const PORT = Number(process.env.SERVER_PORT || 25565)
const USERNAME = process.env.BOT_NAME || "PantherBot"
const OPENAI_KEY = process.env.OPENAI_KEY

/* ================= KEEP ALIVE ================= */
const app = express()
app.get("/", (req, res) => res.send("PantherBot alive 🐆"))
app.listen(3000, () => console.log("Keepalive server running"))

/* ================= OPENAI ================= */
const openai = new OpenAI({
  apiKey: OPENAI_KEY
})

/* ================= BOT ================= */
const bot = mineflayer.createBot({
  host: HOST,
  port: PORT,
  username: USERNAME,
  auth: "offline",
  version: false
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(autoeat)
bot.loadPlugin(collectBlock)
bot.loadPlugin(toolPlugin)

/* ================= EVENTS ================= */
bot.once("spawn", () => {
  console.log("✅ Bot spawned")

  bot.autoEat.options = {
    priority: "foodPoints",
    startAt: 14,
    bannedFood: []
  }

  const mcData = require("minecraft-data")(bot.version)
  const movements = new Movements(bot, mcData)
  bot.pathfinder.setMovements(movements)

  bot.chat("PantherBot online 🐆 Type: !help")
})

bot.on("kicked", console.log)
bot.on("error", console.log)

/* ================= CHAT COMMANDS ================= */
bot.on("chat", async (username, message) => {
  if (username === bot.username) return

  if (message === "!help") {
    bot.chat("Commands: !come | !stop | !follow | !ask <question>")
  }

  if (message === "!come") {
    const target = bot.players[username]?.entity
    if (!target) return bot.chat("I can't see you 👀")

    bot.pathfinder.setGoal(
      new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1)
    )
  }

  if (message === "!stop") {
    bot.pathfinder.setGoal(null)
    bot.chat("Stopped ✋")
  }

  if (message === "!follow") {
    const target = bot.players[username]?.entity
    if (!target) return bot.chat("I can't see you 👀")

    bot.pathfinder.setGoal(
      new goals.GoalFollow(target, 2),
      true
    )
  }

  /* ================= GPT COMMAND ================= */
  if (message.startsWith("!ask ")) {
    if (!OPENAI_KEY) return bot.chat("GPT not configured ❌")

    const question = message.replace("!ask ", "")
    bot.chat("🤔 Thinking...")

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }],
        max_tokens: 100
      })

      const reply = response.choices[0].message.content
      bot.chat(reply.slice(0, 240))
    } catch (err) {
      console.error(err)
      bot.chat("GPT error ❌")
    }
  }
})
