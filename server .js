const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.FOOTBALL_API_TOKEN;

app.disable("x-powered-by");

// Serve website files from the public folder.
app.use(express.static(path.join(__dirname, "public")));

// Supported football competitions.
const competitions = {
    PL: "Premier League",
    PD: "La Liga",
    BL1: "Bundesliga",
    SA: "Serie A",
    FL1: "Ligue 1",
    CL: "Champions League"
};

// Check that the API token has been configured.
function checkToken(req, res, next) {
    if (!API_TOKEN) {
        return res.status(500).json({
            error: "Football API is not configured yet."
        });
    }

    next();
}

// Get available competitions.
app.get("/api/competitions", (req, res) => {
    res.json(competitions);
});

// Retrieve football data securely.
app.get(
    "/api/competitions/:code/:type",
    checkToken,
    async (req, res) => {
        const code = req.params.code.toUpperCase();
        const type = req.params.type.toLowerCase();

        if (!competitions[code]) {
            return res.status(400).json({
                error: "Unsupported competition."
            });
        }

        const endpoints = {
            matches: "matches",
            standings: "standings"
        };

        if (!endpoints[type]) {
            return res.status(400).json({
                error: "Choose matches or standings."
            });
        }

        const apiUrl =
            `https://api.football-data.org/v4/competitions/` +
            `${code}/${endpoints[type]}`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    "X-Auth-Token": API_TOKEN
                },
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(
                    "Football API error:",
                    response.status
                );

                return res.status(response.status).json({
                    error:
                        data.message ||
                        "Unable to retrieve football data."
                });
            }

            // Allow browsers and intermediaries to cache briefly.
            res.set("Cache-Control", "public, max-age=30");

            res.json(data);

        } catch (error) {
            console.error("Request failed:", error.message);

            res.status(502).json({
                error:
                    "Football data is temporarily unavailable."
            });
        }
    }
);

// Website homepage.
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// Start the server.
app.listen(PORT, "0.0.0.0", () => {
    console.log(`FootballHub Pro running on port ${PORT}`);
});
