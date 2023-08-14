const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,

    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        ////request.username = payload.username;
        next();
      }
    });
  }
}

//API login details

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user
  WHERE
  username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//app.get("/profile/", authenticateToken, async (request, response) => {
//let { username } = request;
//const selectUserQuery = `
//SELECT *
//FROM
//user
//WHERE
//username='${username}';`;

//const userDetails = await db.get(selectUserQuery);
//response.send(userDetails);
//});

//API 1

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStateDetails = `
    SELECT * FROM state;`;

  const initialAllStateDetails = await db.all(getAllStateDetails);
  //const stateDetailsArray = initialAllStateDetails.map((eachState) => ({
  //stateName: eachState.state_name,
  //}));
  response.send(
    initialAllStateDetails.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//API 2

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetails = `SELECT * FROM state
    WHERE state_id='${stateId}';`;

  const initialStateDetails = await db.get(getStateDetails);
  response.send(convertStateDbObjectToResponseObject(initialStateDetails));
  //response.send(stateDetailsArray);
});

//module.exports = app;

//API 3

app.post("/districts/", authenticateToken, async (request, response) => {
  const newStateDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = newStateDetails;

  const postNewDetailsQuery = `
    INSERT INTO
    district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;

  const dbResponse = await db.run(postNewDetailsQuery);
  const newDistrict = dbResponse.lastID;
  response.send("District Successfully Added");
});

//API 4

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetails = `SELECT * FROM district
    WHERE district_id='${districtId}';`;

    const initialDistrictDetails = await db.get(getDistrictDetails);
    //const districtDetailsArray=convertDistrictDbObjectToResponseObject(initialDistrictDetails);
    response.send(convertStateDbObjectToResponseObject(initialDistrictDetails));
  }
);

//API 5
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id='${districtId}';`;

    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    //const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const putDistrictQuery = `
    UPDATE district
    SET
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE
    district_id=${districtId};`;

    const updateQuery = await db.run(putDistrictQuery);
    const updateDetails = updateQuery.lastID;
    response.send("District Details Updated");
  }
);

//API-7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
        SELECT 
            SUM(cases),
            SUM(cured),
            SUM(active),
            SUM(deaths)
        FROM 
            district
        WHERE 
            state_id='${stateId}';
    `;
    const stateStats = await db.get(getStatsQuery);
    response.send({
      totalCases: stateStats["SUM(cases)"],
      totalCured: stateStats["SUM(cured)"],
      totalActive: stateStats["SUM(active)"],
      totalDeaths: stateStats["SUM(deaths)"],
    });
  }
);

//API-8
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictName = `
        SELECT
            state_name
        FROM
            state
        NATURAL JOIN
            district
        WHERE 
            district_id='${districtId}';
    `;
    const stateName = await db.get(getDistrictName);
    response.send(convertStateDbObjectToResponseObject(stateName));
  }
);

module.exports = app;
