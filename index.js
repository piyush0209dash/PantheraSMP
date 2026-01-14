require("dotenv").config()

const mineflayer = require("mineflayer")
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder")
const autoeat = require("mineflayer-auto-eat").plugin
const collectBlock = require("mineflayer-collectblock").plugin
const pvp = require("mineflayer-pvp").plugin
const toolPlugin = require("mineflayer-tool").plugin
const express = require("express")

const { GoogleGenerativeAI } = require("@google/generative-ai")

/* ================= CONFIG ================= */

const HOST = process.env.SERVER_IP
const PORT = Number(process.env.SERVER_PORT)
const BOT_NAME = process.env.BOT_NAME || "PantherBot"
const GEMINI_KEY = process.env.GEMINI_API_KEY

/* ================= GEMINI ================= */

let gemini = null
if (GEMINI_KEY) {
  gemini = new GoogleGenerativeAI(GEMINI_KEY)
  console.log("✅ Gemini AI loaded")
} else {
  console.log("❌ Gemini key missing")
}

/* ================= BOT ================= */

const bot = mineflayer.createBot({
  host: HOST,
  port: PORT,
  username: BOT_NAME
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(autoeat)
bot.loadPlugin(collectBlock)
bot.loadPlugin(pvp)
bot.loadPlugin(toolPlugin)

bot.once("spawn", () => {
  console.log("🐆 PantherBot spawned")

  const movements = new Movements(bot)
  bot.pathfinder.setMovements(movements)

  bot.autoEat.options = {
    priority: "foodPoints",
    startAt: 14
  }

  bot.chat("PantherBot online 🐆 Say 'help'!")
})

/* ================= GEMINI BRAIN ================= */

async function decideAction(message) {
  if (!gemini) return null

  const prompt = `
You are PantherBot, a Minecraft helper bot.

Player said: "${message}"

Choose ONE action only:
follow <player>
mine <block>
build house
farm
fight
patrol
tidy
reply <text>

Respond with ONE line only.
`

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" })
    const result = await model.generateContent(prompt)
    return result.response.text().trim().split("\n")[0]
  } catch (e) {
    console.log("Gemini error:", e)
    return null
  }
}

/* ================= ACTIONS ================= */

function safeChat(msg) {
  try { bot.chat(msg) } catch {}
}

async function followPlayer(name) {
  const player = bot.players[name]?.entity
  if (!player) return safeChat("Can't see you 👀")
  bot.pathfinder.setGoal(new goals.GoalFollow(player, 1), true)
}

async function mineBlock(name) {
  const block = bot.findBlock({
    matching: b => b.name === name,
    maxDistance: 32
  })
  if (!block) return safeChat("Block not found 😔")
  await bot.collectBlock.collect(block)
  safeChat(`Mined ${name} ⛏️`)
}

async function buildHouse() {
  safeChat("House building is basic for now 🏠")
}

async function farm() {
  safeChat("Farming mode 🌾")
}

async function fight() {
  const mob = bot.nearestEntity(e => e.type === "mob")
  if (!mob) return safeChat("No mobs nearby 😴")
  bot.pvp.attack(mob)
}

async function patrol() {
  safeChat("Patrolling area 🚓")
}

async function tidy() {
  for (const item of bot.inventory.items()) {
    try { await bot.tossStack(item) } catch {}
  }
  safeChat("Inventory cleaned 🧹")
}

/* ================= CHAT ================= */

bot.on("chat", async (username, message) => {
  if (username === bot.username) return

  const msg = message.toLowerCase()

  if (msg === "help") {
    return safeChat("Commands: follow me, mine <block>, farm, fight")
  }

  if (msg === "follow me") return followPlayer(username)
  if (msg.startsWith("mine ")) return mineBlock(msg.split(" ")[1])
  if (msg === "farm") return farm()
  if (msg === "fight") return fight()

  safeChat("Thinking... 🤔")
  const action = await decideAction(message)
  if (!action) return safeChat("Brain lag 😵")

  const [cmd, ...rest] = action.split(" ")
  const arg = rest.join(" ")

  if (cmd === "reply") return safeChat(arg)
  if (cmd === "follow") return followPlayer(arg)
  if (cmd === "mine") return mineBlock(arg)
  if (cmd === "build") return buildHouse()
  if (cmd === "farm") return farm()
  if (cmd === "fight") return fight()
  if (cmd === "patrol") return patrol()
  if (cmd === "tidy") return tidy()

  safeChat("Didn't understand 🤷")
})

/* ================= KEEP ALIVE ================= */

const app = express()
app.get("/", (_, res) => res.send("PantherBot alive 🐆"))
app.listen(process.env.PORT || 3000)
