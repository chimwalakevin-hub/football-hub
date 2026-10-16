const competitionNames = {
PL: "Premier League",
PD: "La Liga",
BL1: "Bundesliga",
SA: "Serie A",
FL1: "Ligue 1",
CL: "Champions League"
};

const liveStatuses = ["IN_PLAY", "PAUSED", "LIVE"];
const finishedStatuses = ["FINISHED", "AWARDED"];

let currentFilter = "ALL";
let matchesRequestId = 0;
let standingsRequestId = 0;

const $ = (id) => document.getElementById(id);

$("currentYear").textContent = new Date().getFullYear();

// Mobile navigation
$("menuToggle").addEventListener("click", () => {
const navigation = $("navigation");
const isOpen = navigation.classList.toggle("open");

$("menuToggle").setAttribute("aria-expanded", String(isOpen));

});

document.querySelectorAll(".navigation a").forEach((link) => {
link.addEventListener("click", () => {
$("navigation").classList.remove("open");
$("menuToggle").setAttribute("aria-expanded", "false");
});
});

// Team search
$("teamSearch").addEventListener("input", (event) => {
const search = event.target.value.trim().toLowerCase();
let visibleCount = 0;

document.querySelectorAll(".team-card").forEach((card) => {
    const matches = card.dataset.name.includes(search);

    card.classList.toggle("hidden", !matches);

    if (matches) visibleCount++;
});

$("noTeams").classList.toggle("hidden", visibleCount !== 0);

});

// Match filters
$("matchFilters").addEventListener("click", (event) => {
const button = event.target.closest("[data-filter]");

if (!button) return;

currentFilter = button.dataset.filter;

document.querySelectorAll(".filter-button").forEach((item) => {
    item.classList.toggle("active", item === button);
});

loadMatches();

});

$("matchCompetition").addEventListener("change", loadMatches);
$("tableCompetition").addEventListener("change", loadStandings);
$("refreshMatches").addEventListener("click", () => {
loadMatches(true);
});

// Escape text before placing API-provided names into HTML.
function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, (char) => ({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
})[char]);
}

function safeImage(url) {
if (typeof url !== "string") return "";

try {
    const parsed = new URL(url);

    if (parsed.protocol === "https:") {
        return parsed.href;
    }
} catch (_) {}

return "";

}

function formatDate(value) {
if (!value) return "Date unavailable";

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
}

return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Blantyre"
}) + " CAT";

}

function formatKickoff(value) {
if (!value) return "TBD";

const date = new Date(value);

if (Number.isNaN(date.getTime())) return "TBD";

return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Blantyre"
});

}

function getMatchStatus(match) {
const status = match.status;

if (liveStatuses.includes(status)) return "LIVE";

if (status === "PAUSED") return "HALF-TIME";

if (finishedStatuses.includes(status)) return "FULL-TIME";

if (status === "POSTPONED") return "POSTPONED";

if (status === "CANCELLED") return "CANCELLED";

if (status === "SUSPENDED") return "SUSPENDED";

if (status === "TIMED") return formatKickoff(match.utcDate);

if (status === "IN_PLAY") return "LIVE";

return status || "SCHEDULED";

}

function isLive(match) {
return liveStatuses.includes(match.status);
}

function isFinished(match) {
return finishedStatuses.includes(match.status);
}

function matchPassesFilter(match) {
if (currentFilter === "LIVE") return isLive(match);

if (currentFilter === "FINISHED") return isFinished(match);

if (currentFilter === "SCHEDULED") {
    return !isLive(match) &&
        !isFinished(match) &&
        ["SCHEDULED", "TIMED"].includes(match.status);
}

return true;

}

function matchCard(match) {
const home = match.homeTeam || {};
const away = match.awayTeam || {};
const score = match.score || {};
const fullTime = score.fullTime || {};

const status = getMatchStatus(match);
const played = isLive(match) || isFinished(match);

const homeScore = fullTime.home;
const awayScore = fullTime.away;

const scoreText = played &&
    homeScore != null &&
    awayScore != null
    ? `${homeScore} - ${awayScore}`
    : "VS";

const homeCrest = safeImage(home.crest);
const awayCrest = safeImage(away.crest);

const homeImage = homeCrest
    ? `<img src="${escapeHTML(homeCrest)}" alt=""
         loading="lazy" onerror="this.style.visibility='hidden'">`
    : "";

const awayImage = awayCrest
    ? `<img src="${escapeHTML(awayCrest)}" alt=""
         loading="lazy" onerror="this.style.visibility='hidden'">`
    : "";

const competition = match.competition?.name ||
    competitionNames[$("matchCompetition").value] ||
    "Football";

return `
    <article class="match-card">
        <div class="match-card-top">
            <span class="competition-name">${escapeHTML(competition)}</span>
            <span class="match-status">${escapeHTML(status)}</span>
        </div>

        <div class="match-teams">
            <div class="match-team">
                ${homeImage}
                <span>${escapeHTML(home.name || "Home team")}</span>
            </div>

            <div class="${played ? "match-score" : "match-time"}">
                ${escapeHTML(scoreText)}
            </div>

            <div class="match-team">
                ${awayImage}
                <span>${escapeHTML(away.name || "Away team")}</span>
            </div>
        </div>

        <div class="match-meta">
            ${escapeHTML(formatDate(match.utcDate))}
        </div>
    </article>
`;

}

async function loadMatches(showLoading = false) {
const requestId = ++matchesRequestId;
const competition = $("matchCompetition").value;
const container = $("matches");

if (showLoading || !container.dataset.loaded) {
    container.innerHTML =
        '<div class="loading-card">Loading football matches...</div>';
}

try {
    const response = await fetch(
        `/api/competitions/${encodeURIComponent(competition)}/matches`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Could not load matches.");
    }

    if (requestId !== matchesRequestId) return;

    const matches = Array.isArray(data.matches) ? data.matches : [];

    matches.sort((a, b) => {
        const aDate = new Date(a.utcDate || 0).getTime();
        const bDate = new Date(b.utcDate || 0).getTime();

        return aDate - bDate;
    });

    const filtered = matches.filter(matchPassesFilter);

    $("matchDate").textContent =
        `${competitionNames[competition]} · ${matches.length} matches returned`;

    if (!filtered.length) {
        container.innerHTML = `
            <div class="loading-card">
                No matches available for this filter.
                Try another filter or competition.
            </div>
        `;
    } else {
        container.innerHTML = filtered
            .map(matchCard)
            .join("");
    }

    container.dataset.loaded = "true";

    $("matchNote").textContent =
        "Data supplied by football-data.org. Availability and update frequency depend on your API plan.";

} catch (error) {
    if (requestId !== matchesRequestId) return;

    container.innerHTML = `
        <div class="error-card">
            <strong>Matches could not be loaded.</strong>
            <p>${escapeHTML(error.message)}</p>
            <p>Check your server, API token and competition access.</p>
            <button class="button button-outline"
                onclick="loadMatches(true)">Try again</button>
        </div>
    `;
}

}

async function loadStandings() {
const requestId = ++standingsRequestId;
const competition = $("tableCompetition").value;
const body = $("standingsBody");

body.innerHTML = `
    <tr><td colspan="8" class="empty-cell">
        Loading league table...
    </td></tr>
`;

$("tableTitle").textContent = competitionNames[competition];

try {
    const response = await fetch(
        `/api/competitions/${encodeURIComponent(competition)}/standings`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Could not load standings.");
    }

    if (requestId !== standingsRequestId) return;

    const table = (data.standings || []).find((item) =>
        item.type === "TOTAL" ||
        item.type === "LEAGUE_TABLE"
    ) || (data.standings || [])[0];

    const rows = table?.table || [];

    if (!rows.length) {
        body.innerHTML = `
            <tr><td colspan="8" class="empty-cell">
                No standings are available for this competition.
            </td></tr>
        `;
        return;
    }

    body.innerHTML = rows.map((team) => {
        const crest = safeImage(team.team?.crest);
        const image = crest
            ? `<img src="${escapeHTML(crest)}" alt=""
                 loading="lazy"
                 onerror="this.style.visibility='hidden'">`
            : "";

        return `
            <tr>
                <td class="position">${Number(team.position) || "-"}</td>
                <td>
                    <div class="club-name">
                        ${image}
                        <span>${escapeHTML(team.team?.name || "Unknown club")}</span>
                    </div>
                </td>
                <td>${Number(team.playedGames) || 0}</td>
                <td>${Number(team.won) || 0}</td>
                <td>${Number(team.draw) || 0}</td>
                <td>${Number(team.lost) || 0}</td>
                <td>${Number(team.goalDifference) || 0}</td>
                <td class="points">${Number(team.points) || 0}</td>
            </tr>
        `;
    }).join("");

    $("tableNote").textContent =
        "Standings are supplied by football-data.org and may depend on your API subscription.";

} catch (error) {
    if (requestId !== standingsRequestId) return;

    body.innerHTML = `
        <tr>
            <td colspan="8" class="empty-cell">
                ${escapeHTML(error.message)}
                <br><br>
                Check your API configuration and competition access.
            </td>
        </tr>
    `;
}

}

// Initial page load
loadMatches();
loadStandings();

// Refresh periodically while the page remains open.
setInterval(() => {
loadMatches();
loadStandings();
}, 120000);
