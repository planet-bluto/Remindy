var socket = io()

//// ELEMENTS ////////////////////////////////////////////////////////////////////////////////////////////////

var back_button = new Elem("back-header-button")
var prev_button = new Elem("prev-header-button")
var next_button = new Elem("next-header-button")
var new_button = new Elem("new-header-button")

var new_task_form_elem = new Elem("new-task-form")
var new_task_form_submit = new Elem("new-task-submit")
var task_popup_elem = new Elem("task-popup")
var task_popup_complete_elem = new Elem("task-popup-complete")
var task_popup_uncomplete_elem = new Elem("task-popup-uncomplete")
var task_popup_edit_elem = new Elem("task-popup-edit")
var task_popup_delete_elem = new Elem("task-popup-delete")
var task_popup_snooze_elem = new Elem("task-popup-snooze")

var fade_elem = new Elem("fade")

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

function TEMPLATE_TASK() {
	print(moment(Date.now()).format("YYYY-MM-DDTH:mm"))
	return {
		title: "New Task",
		due: moment(moment(Date.now()).format("YYYY-MM-DDTH:mm")),
		reminder: {
			time: moment(moment(Date.now()).format("YYYY-MM-DDTH:mm")),
			message: '@everyone\n# ⏰ {title}\n### {due_relative}'
		},
		repeats: {
			amount: 1,
			unit: "weeks"
		}
	}
}

//// VARIABLES ////////////////////////////////////////////////////////////////////////////////////////////////

var current_month = (moment().month()+1)
var current_year = moment().year()
var current_week = null

var editingTask = null

var task_cache = []
socket.emitWithAck("getTasks").then(tasks => {
	task_cache = tasks
	if (current_week == null) {
		renderMonth()
	}
})

var timestampInts = []
// for (let i = 0; i < 20; i++) {
// 	var unit = Object.keys(UNITS)[randiRange(3, 6)]
// 	var amount = randiRange(1, 3)

// 	task_cache.push({
// 		title: `${moment(1712808000000).format("M/D")} every ${amount} ${unit}`,
// 		due: 1712808000000,
// 		repeats: {
// 			amount,
// 			unit
// 		}
// 	})
// }

// task_cache.push({
// 	title: `${moment(1712808000000).format("M/D")} every ${1} ${"weeks"}`,
// 	due: 1712808000000,
// 	repeats: {
// 		amount: 1,
// 		unit: "weeks"
// 	}
// })

//// UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////////////

function wrap(i, max) {return i % max}

function isOnDay(date, base, repeats) {
	date = moment(date).startOf("days").valueOf()
	base = moment(base).startOf("days").valueOf()

	if (repeats) {
	    return isRepeat(date, base, repeats.unit, repeats.amount)
	} else {
		return isEqual(date, base)
	}
}

function isRepeat(date, base, unit, freq) {
	var diff = moment(date).diff(base, unit, true)

    return (!`${diff / (freq)}`.includes("."))
}

function isEqual(date, base) {
	var pleasant_date = moment(moment(date).format("YYYY-MM-DDThh:mm")).valueOf()
	var pleasant_base = moment(moment(base).format("YYYY-MM-DDThh:mm")).valueOf()

	return (pleasant_date == pleasant_base)
}

function calendarBounds(month_iq = (moment().month()+1), year_iq = moment().year(), sub = false) {
	var peen = moment().month(month_iq-1).year(year_iq)
    var to_return = {
    	month: peen.format("MMMM"),
    	year: peen.format("YYYY"),
    	startWeekDay: peen.date(1).isoWeekday(),
    	endWeekDay: peen.date(peen.daysInMonth()).isoWeekday(),
    	daysInMonth: peen.daysInMonth(),
    	rows: 1 + Math.ceil((peen.daysInMonth() - (8-peen.date(1).isoWeekday())) / 7),
    	startGap: 7-(8-peen.date(1).isoWeekday()),
    	endGap: 7-peen.date(peen.daysInMonth()).isoWeekday(),
    }

    if (!sub) {
    	var prevYear = (month_iq == 1 ? year_iq - 1 : year_iq)
    	var nextYear = (month_iq == 12 ? year_iq + 1 : year_iq)

    	to_return["prevMonth"] = calendarBounds(wrap(month_iq-1, 12), prevYear, true)
    	to_return["nextMonth"] = calendarBounds(wrap((month_iq-1)+2, 12), nextYear, true)
    }

    return to_return
}

function generateWeekDates(date_iq = moment().date(), month_iq = (moment().month()+1), year_iq = moment().year()) {
	var peen = moment().year(year_iq).month(month_iq-1).date(date_iq)
	var bounds = calendarBounds(month_iq, year_iq)
	var dow = peen.isoWeekday()

	// var weekNum = ((date_iq <= (7-bounds.startGap)) ? 1 : )
	var weekNum = Math.floor((date_iq-(8-bounds.startGap))/7)+2
	var thisMonday = peen.subtract((dow-1), "days")

	return {
		"Monday": moment(thisMonday.format("M/D/YYYY")),
		"Tuesday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
		"Wednesday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
		"Thursday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
		"Friday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
		"Saturday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
		"Sunday": moment(thisMonday.add(1, "days").format("M/D/YYYY")),
	}
}

function generateCalendarDates(month_iq = (moment().month()+1), year_iq = moment().year()) {
	var peen = moment().month(month_iq-1).year(year_iq)
	var weeks = []

	for (var i = 0; i < 6; i++) {
		weeks.push(Object.values(generateWeekDates((i*7)+1, month_iq, year_iq)))
	}

	return weeks
}

function renderMonth(month_iq = current_month, year_iq = current_year) {
	var main_month_elem = new Elem("main-month")
	var weeks = generateCalendarDates(month_iq, year_iq)

	if (current_week == null) {
		main_month_elem.clear()
		weeks.forEach(week => {
			var week_elem = new Elem("div")
			week_elem.classes.add("month-week")
			week_elem.on("click", e=>{
				highlightWeekElem(week_elem, week)
			})
			main_month_elem.addChild(week_elem)
		})
	} else {
		fillOutTaskContainers()
	}

	weeks.forEach((week, week_ind) => {
		var week_elem = main_month_elem.children[week_ind]
		week_elem.clear()
		week.forEach((date, week_ind) => {
			var date_elem = new Elem("div")
			date_elem.classes.add("month-date")
			if (date.format("M/D/YYYY") == moment().format("M/D/YYYY")) {
				date_elem.setAttr("today", "")
			}

			var count = taskCount(date)

			date_elem.html = `<span>${date.format("ddd M/D")}</span>` + `<span style="opacity: 0.5">(${count})</span>`
			if ((date.month()+1) != month_iq) {
				date_elem.setAttr("disabled", "")
			}
			week_elem.addChild(date_elem)
		})
	})
}

function taskCount(date) {
	var temp_task_cache = task_cache.filter(task => {
		var valid = isOnDay(date.valueOf(), moment(task.due).startOf('day').valueOf(), task.repeats)

		if (!Array.isArray(task.completed)) { task.completed = [] }
		var isCompleted = task.completed.includes(date.format("YYYY-MM-DD"))
		if (isCompleted) { valid = false }

		return valid
	})
	return temp_task_cache.length
}

function renderWeekHeader() {
	var week_header_elem = new Elem("week-header")
	var DOWs = [
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",	
		"Saturday",
		"Sunday",
	]

	for (var i = 0; i < 7; i++) {
		var this_week_elem = new Elem("div")
		this_week_elem.classes.add("week-header-week")
		this_week_elem.text = DOWs[i]
		week_header_elem.addChild(this_week_elem)
	}
}

function fillOutTaskContainers(week = current_week) {
	if (week == null) { return }

	new Elem("task-containers").clear()
	week.forEach(date => {
		var task_container = new Elem("div")
		// print(i)

		task_container.classes.add("task-container")
		// task_container

		task_cache.forEach(task => {
			if (isOnDay(date.valueOf(), task.due, task.repeats)) {
				var task_elem = new Elem("div")

				task_elem.classes.add("task")

				var task_elem_title = new Elem("p")
				task_elem_title.classes.add("task-title")
				task_elem_title.text = task.title
				task_elem.addChild(task_elem_title)

				var task_elem_time_exact = new Elem("p")
				task_elem_time_exact.classes.add("task-time-exact")
				task_elem_time_exact.text = moment(task.due).format("H:mm A")
				task_elem.addChild(task_elem_time_exact)

				var task_elem_time_relative = new Elem("p")
				task_elem_time_relative.classes.add("task-time-relative")
				task_elem_time_relative.text = moment(task.due).fromNow()
				timestampInts.push(setInterval(() => {
					task_elem_time_relative.text = moment(task.due).fromNow()
				}, 1000))
				task_elem.addChild(task_elem_time_relative)

				if (!Array.isArray(task.completed)) { task.completed = [] }
				var isCompleted = task.completed.includes(date.format("YYYY-MM-DD"))
				if (isCompleted) {
					task_elem.setAttr("completed", "")
				}

				task_elem.on("click", e => {
					fade_elem.setAttr("active", "")
					task_popup_elem.setAttr("active", "")

					task_popup_complete_elem.notOn("click")
					task_popup_complete_elem.on("click", async e => {
						print("Completing Task: ", task)
						var newTask = await socket.emitWithAck("completeTask", task, date.format("YYYY-MM-DD"))
						var i = task_cache.findIndex(this_task => this_task.id == task.id)
						task_cache[i] = newTask
						renderMonth()
						closeAllPopups()
					})

					task_popup_uncomplete_elem.notOn("click")
					task_popup_uncomplete_elem.on("click", async e => {
						print("Uncompleting Task: ", task)
						var newTask = await socket.emitWithAck("uncompleteTask", task, date.format("YYYY-MM-DD"))
						var i = task_cache.findIndex(this_task => this_task.id == task.id)
						task_cache[i] = newTask
						renderMonth()
						closeAllPopups()
					})

					if (isCompleted) {
						task_popup_complete_elem.style.setProperty("display", "none")
						task_popup_uncomplete_elem.style.setProperty("display", "block")
					} else {
						task_popup_complete_elem.style.setProperty("display", "block")
						task_popup_uncomplete_elem.style.setProperty("display", "none")
					}

					task_popup_edit_elem.notOn("click")
					task_popup_edit_elem.on("click", e => {
						editingTask = task

						loadTaskToForm(task)

						closeAllPopups()

						fade_elem.setAttr("active", "")
						new_task_form_elem.setAttr("active", "")
					})

					task_popup_delete_elem.notOn("click")
					task_popup_delete_elem.on("click", async e => {
						var confirm = window.confirm("On god?")
						if (confirm) {
							var deleted = await socket.emitWithAck("deleteTask", task)
							closeAllPopups()

							if (deleted) {
								var i = task_cache.findIndex(this_task => this_task.id == task.id)
								task_cache.remove(i)

								renderMonth()
							}
						}
					})

					task_popup_snooze_elem.notOn("click")
					task_popup_snooze_elem.on("click", e => {

					})

				})

				task_container.addChild(task_elem)
			}
		})

		new Elem("task-containers").addChild(task_container)
	})
}

var weeks_tweening = false
var current_week_elem = null
function highlightWeekElem(highlighted_week_elem, week) {
	if (weeks_tweening || current_week_elem != null) {return}
	weeks_tweening = true

	current_week = week

	fillOutTaskContainers()

	back_button.style.setProperty("display", "block")
	prev_button.style.setProperty("display", "none")
	next_button.style.setProperty("display", "none")

	var week_elems = getClass("month-week")
	var main_month_elem = new Elem("main-month")
	var task_containers_elem = new Elem("task-containers")
	task_containers_elem.setAttr("active", "")
	highlighted_week_elem.setAttr("active", "")
	current_week_elem = highlighted_week_elem

	var base_height = null
	var tween_int = tween(600, EASE_OUT_QUART, (raw_x) => {
		var month_x = lerp(15.0, 0.0, raw_x)
		main_month_elem.style.setProperty("gap", `${month_x}px`)

		var other_month_x = lerp(0.0, 15.0, raw_x)
		main_month_elem.style.setProperty("margin-bottom", `${other_month_x}px`)

		var other_month_height = lerp(100.0, 64.0, raw_x)
		main_month_elem.style.setProperty("height", `${other_month_height}px`)

		var task_container_height = lerp(0.0, 100.0, raw_x)
		task_containers_elem.style.setProperty("height", `calc(${task_container_height}% - 15px)`)

		week_elems.forEach(week_elem => {
			if (week_elem.elem != highlighted_week_elem.elem) {
				let x = lerp(1.0, 0.0, raw_x)
				week_elem.style.setProperty("height", `${x*100}%`)
				week_elem.style.setProperty("opacity", `${x}`)
			} else {
				if (base_height == null) { base_height = week_elem.elem.getBoundingClientRect().height }
				let x = lerp(base_height, 64.0, raw_x)
				week_elem.style.setProperty("height", `${x}px`)
			}
		})
	})

	awaitTween(tween_int).then(() => {
		weeks_tweening = false
	})
}

function unhighlightWeekElem() {
	if (weeks_tweening || current_week_elem == null) {return}
	weeks_tweening = true

	timestampInts.forEach(int => {
		clearInterval(int)
	})
	timestampInts = []

	current_week = null

	back_button.style.setProperty("display", "none")
	prev_button.style.setProperty("display", "block")
	next_button.style.setProperty("display", "block")

	var highlighted_week_elem = current_week_elem
	highlighted_week_elem.removeAttr("active")
	var main_month_elem = new Elem("main-month")
	var task_containers_elem = new Elem("task-containers")
	task_containers_elem.removeAttr("active")
	var week_elems = getClass("month-week")

	var tween_int = tween(600, EASE_IN_CUBIC_OUT_QUART, (flipped_raw_x) => {
		var raw_x = lerp(1.0, 0.0, flipped_raw_x)
		var month_x = lerp(15.0, 0.0, raw_x)
		main_month_elem.style.setProperty("gap", `${month_x}px`)

		var other_month_x = lerp(0.0, 15.0, raw_x)
		main_month_elem.style.setProperty("margin-bottom", `${other_month_x}px`)

		var other_month_height = lerp(100.0, 64.0, raw_x)
		main_month_elem.style.setProperty("height", `calc(${other_month_height}% - 64px - 30px)`)

		var task_container_height = lerp(0.0, 100.0, raw_x)
		task_containers_elem.style.setProperty("height", `${task_container_height}%`)
		week_elems.forEach(week_elem => {
			if (week_elem.elem != highlighted_week_elem.elem) {
				let x = lerp(1.0, 0.0, raw_x)
				week_elem.style.setProperty("height", `${x*100}%`)
				week_elem.style.setProperty("opacity", `${x}`)
			} else {
				let x = lerp(1.0, 0.0, raw_x)
				week_elem.style.setProperty("height", `${x*100}%`)
			}
		})
	})

	awaitTween(tween_int).then(() => {
		current_week_elem = null
		weeks_tweening = false
	})
}

//// BUTTON SETUP ////////////////////////////////////////////////////////////////////////////////////////////////

back_button.on("click", e => {
	unhighlightWeekElem()
})

// Animate switching between months similarly to how you did for the selection animation
// var bounds = calendarBounds(current_month)
// var collapseAmount = bounds.rows
// if (endGap > 0) { collapseAmount = bounds.rows-1 }

prev_button.on("click", e => {
	current_month -= 1
	if (current_month == 0) {
		current_month = 12
		current_year -= 1
	}
	renderMonth(current_month, current_year)
})

next_button.on("click", e => {
	current_month += 1
	if (current_month == 13) {
		current_month = 1
		current_year += 1
	}
	renderMonth(current_month, current_year)
})

back_button.style.setProperty("display", "none")
prev_button.style.setProperty("display", "block")
next_button.style.setProperty("display", "block")

new_button.on("click", e => {
	fade_elem.setAttr("active", "")
	new_task_form_elem.setAttr("active", "")
	if (editingTask == null) {
		loadTaskToForm(TEMPLATE_TASK())
	}
})

new_task_form_submit.on("click", async e => {
	var task = {
		completed: [],
		snooze: {}
	}

	var title_elem = new Elem("new-task-title")
	task["title"] = title_elem.value

	var due_elem = new Elem("new-task-due")
	task["due"] = moment(due_elem.value, "YYYY-MM-DDTH:mm").valueOf()

	task["reminder"] = {}
	var reminder_time_elem = new Elem("new-task-reminder")
	// print(reminder_time_elem.value, (reminder_time_elem.value == ""), task["due"], moment(reminder_time_elem.value, moment.DATETIME_LOCAL).valueOf())
	task["reminder"]["time"] = (reminder_time_elem.value == "" ? task["due"] : moment(reminder_time_elem.value, "YYYY-MM-DDTH:mm").valueOf())

	var reminder_message_elem = new Elem("new-task-reminder-message")
	task["reminder"]["message"] = reminder_message_elem.value

	var repeats_enabled_elem = new Elem("new-task-repeats")
	if (repeats_enabled_elem.elem.checked) {
		task["repeats"] = {}

		var repeat_amount_elem = new Elem("new-task-repeat-amount")
		task["repeats"]["amount"] = Number(repeat_amount_elem.value)

		var repeat_unit_elem = new Elem("new-task-repeat-unit")
		task["repeats"]["unit"] = repeat_unit_elem.value
	} else {
		task["repeats"] = null
	}

	if (editingTask == null) {
		task = await socket.emitWithAck("newTask", task)
		task_cache.push(task)
	} else {
		task = await socket.emitWithAck("editTask", editingTask, task)
		var i = task_cache.findIndex(this_task => this_task.id == editingTask.id)
		task_cache[i] = task
	}

	editingTask = null

	renderMonth()
	closeAllPopups()
})

function loadTaskToForm(task) {
	var title_elem = new Elem("new-task-title")
	title_elem.value = task["title"]

	var due_elem = new Elem("new-task-due")
	due_elem.value = moment(task["due"]).format("YYYY-MM-DDTH:mm")

	var reminder_time_elem = new Elem("new-task-reminder")
	reminder_time_elem.value = moment(task["reminder"]["time"]).format("YYYY-MM-DDTH:mm")

	var reminder_message_elem = new Elem("new-task-reminder-message")
	reminder_message_elem.value = task["reminder"]["message"]

	var repeats_enabled_elem = new Elem("new-task-repeats")
	repeats_enabled_elem.elem.checked = (task["repeats"] != null)

	if (repeats_enabled_elem.elem.checked) {
		var repeat_amount_elem = new Elem("new-task-repeat-amount")
		repeat_amount_elem.value = task["repeats"]["amount"]

		var repeat_unit_elem = new Elem("new-task-repeat-unit")
		repeat_unit_elem.value = task["repeats"]["unit"]
	}
}

function closeAllPopups() {
	fade_elem.removeAttr("active")
	new_task_form_elem.removeAttr("active")
	task_popup_elem.removeAttr("active")
}

fade_elem.on("click", () => {
	closeAllPopups()
	editingTask = null
})

//// RUN THOSE FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////////////

renderWeekHeader()
renderMonth()