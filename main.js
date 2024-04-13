global.print = console.log
require('dotenv').config()
require("./arrayLib.js")

var moment = require('moment')
var path = require('path')

const websitePath = path.resolve(__dirname, 'website')

//// CONSTANTS (but not really) ////////////////////////////////////////////////////////////////////////////////////////////////

const SECOND = 1000
const MINUTE = 60000
const HOUR = 3600000
const DAY = 86400000
const WEEK = 604800000
const MONTH = 2419200000
const YEAR = 31536000000

const UNITS = {
	"seconds": SECOND,
	"minutes": MINUTE,
	"hours": HOUR,
	"days": DAY,
	"weeks": WEEK,
	"months": MONTH,
	"years": YEAR
}

//// DISCORD ////////////////////////////////////////////////////////////////////////////////////////////////

const { Client, IntentsBitField, Partials, Collection, Events } = require('discord.js')
const client = new Client({ intents: Object.values(IntentsBitField.Flags), partials: Object.values(Partials) })

//// DATABASE ////////////////////////////////////////////////////////////////////////////////////////////////

const { CordXSnowflake } = require('@cordxapp/snowflake')
const snowflake = new CordXSnowflake({
    workerId: 1, // Unique identifier for the worker generating IDs
    processId: 2, // Unique identifier for the process generating IDs
    epoch: 3, // Starting point in time for generating IDs
    increment: 4, // Ensures uniqueness of IDs generated in the same millisecond
    sequence: 5n, // Additional measure to ensure uniqueness
    debug: false // Enable or disable debug logging
})
const {BluDB, REPLBuilder, JSONBuilder} = require("bludb")
const DB = new BluDB(
	JSONBuilder(),
	// REPLBuilder(process.env["REPLIT_DB_URL"]),
)

//// SERVER ////////////////////////////////////////////////////////////////////////////////////////////////

const express = require('express')
const app = express()
const httpserver = require('http').createServer(app);
const {Server} = require('socket.io');
const io = new Server(httpserver, {
  maxHttpBufferSize: 100e6
})

function startServer() {
	httpserver.listen((process.env["port"] || 4848), "0.0.0.0", (e) => {
		print("+ Server Listening!")
	})
}

//// SERVER LOGIC ////////////////////////////////////////////////////////////////////////////////////////////////

app.use("/", express.static(websitePath, {index: false}))

app.get("/", (req, res) => {
	res.sendFile('/index.html', {root: websitePath})
})

//// SOCKET LOGIC ////////////////////////////////////////////////////////////////////////////////////////////////

io.on("connection", socket => {
	socket.on("message", async content => {
		var channel = await client.channels.fetch("1227714666554331309")
		await channel.send(content)
	})

	socket.on("getTasks", async (callback) => {
		var tasks = []

		var keys = await DB.keys()
		await keys.awaitForEach(async key => {
			if (key.startsWith("tasks/")) {
				var TaskDB = await DB.fetch(key)
				TaskDB.data["id"] = key.split("/")[1]
				tasks.push(TaskDB.data)
			}
		})

		callback(tasks)
	})

	socket.on("newTask", async (task, callback) => {
		var id = snowflake.generate()

		var TaskDB = await DB.fetch(`tasks/${id}`)

		TaskDB.data = task
		TaskDB.data["id"] = id

		await TaskDB.write()

		callback(TaskDB.data)
	})

	socket.on("completeTask", async (task, pleasant_date, callback) => {
		print("Completed: ", task.id + ":" + task.title)
		var TaskDB = await DB.fetch(`tasks/${task.id}`)

		if (!Array.isArray(TaskDB.data["completed"])) { TaskDB.data["completed"] = [] }
		if (!TaskDB.data["completed"].includes(pleasant_date)) {
			TaskDB.data["completed"].push(pleasant_date)
		}
		TaskDB.data["id"] = task.id

		await TaskDB.write()

		callback(TaskDB.data)
	})

	socket.on("uncompleteTask", async (task, pleasant_date, callback) => {
		print("Uncompleted: ", task.id + ":" + task.title)
		var TaskDB = await DB.fetch(`tasks/${task.id}`)

		if (Array.isArray(TaskDB.data["completed"])) {
			var i = TaskDB.data["completed"].indexOf(pleasant_date)
			if (i != -1) {
				TaskDB.data["completed"].remove(i)
			}
		}
		TaskDB.data["id"] = task.id

		await TaskDB.write()

		callback(TaskDB.data)
	})

	socket.on("editTask", async (editingTask, task, callback) => {
		print("Editing...: ", editingTask.id + ":" + editingTask.title)
		var TaskDB = await DB.fetch(`tasks/${editingTask.id}`)

		TaskDB.data = task
		TaskDB.data["id"] = editingTask.id

		await TaskDB.write()

		callback(TaskDB.data)
	})

	socket.on("deleteTask", async (task, callback) => {
		print("Deleting...: ", task.id + ":" + task.title)
		await DB.delete(`tasks/${task.id}`)

		callback(true)
	})
})

//// DISCORD LOGIC ////////////////////////////////////////////////////////////////////////////////////////////////

client.on("ready", async () => {
	print(`+ ${client.user.username} has logged in!`)
	startServer()
	setTimeout(startLoop, ((Math.ceil(Date.now()/SECOND)*SECOND) - Date.now()))
})

async function safeSend(channel_id, ...args) {
		var channel = await client.channels.fetch(channel_id)
		await channel.send(...args)
}

//// INIT ////////////////////////////////////////////////////////////////////////////////////////////////

client.login(process.env["token"])

//// INIT ////////////////////////////////////////////////////////////////////////////////////////////////

function isRightNow(date, base, repeats) {
	if (repeats) {
		return isRepeat(date, base, repeats.unit, repeats.amount)
	} else {
		return isEqualTime(date, base)
	}
}

function isRepeat(date, base, unit, freq) {
	var diff = moment(date).diff(base, unit, true)

    return (!`${diff / (freq)}`.includes("."))
}

function isEqualDate(date, base) {
	var pleasant_date = moment(moment(date).format("YYYY-MM-DD")).valueOf()
	var pleasant_base = moment(moment(base).format("YYYY-MM-DD")).valueOf()

	return (pleasant_date == pleasant_base)
}

function isEqualTime(date, base) {
	var pleasant_date = moment(moment(date).format("YYYY-MM-DDTHH:mm")).valueOf()
	var pleasant_base = moment(moment(base).format("YYYY-MM-DDTHH:mm")).valueOf()

	return (pleasant_date == pleasant_base)
}

var current_time = null
function startLoop() {
	setInterval(async () => {
		var toStandard = (timestamp) => { return moment(timestamp).format("H:mm A") }

		var this_current_time = toStandard(Date.now())
		var pleasant_timestamp = moment(moment().format("YYYY-MM-DDTHH:mm")).valueOf()

		if (current_time != this_current_time) { //// NEW MINUTE
			current_time = this_current_time

			var keys = await DB.keys()
			keys.forEach(async key => {
				if (key.startsWith("tasks/")) {
					var TaskDB = await DB.fetch(key)
					var task = TaskDB.data
					if (!Array.isArray(task.completed)) { task.completed = [] }
					var isCompleted = task.completed.includes(moment().format("YYYY-MM-DD"))

					if (isRightNow(pleasant_timestamp, TaskDB.data.reminder.time, TaskDB.data.repeats)) {
						var due_on_date = moment(task.due)
						due_on_date.year(moment().year())
						due_on_date.month(moment().month())
						due_on_date.date(moment().date())

						var msg_content = TaskDB.data.reminder.message
						msg_content = msg_content.replaceAll("{title}", TaskDB.data.title)
						msg_content = msg_content.replaceAll("{due_relative}", `<t:${Math.round(due_on_date.valueOf() / 1000)}:R>`)
						await safeSend("1227714666554331309", {content: msg_content})
					}
				}
			})

		}
	}, 16)
}