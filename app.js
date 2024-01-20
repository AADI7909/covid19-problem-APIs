const express = require('express')
const app = express()
app.use(express.json())
const {open} = require('sqlite')
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

// API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = "${username}";`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'ADITYA')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// Middleware function
const AuthenicteToken = async (request, response, next) => {
  let jwtToken
  const AuthorHeader = request.headers['authorization']
  if (AuthorHeader !== undefined) {
    jwtToken = AuthorHeader.split(' ')[1]
    if (jwtToken === undefined) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      jwt.verify(jwtToken, 'ADITYA', async (error, payload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          next()
        }
      })
    }
  }
}

const ConvertTocamelCase = each => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  }
}

// API 2
app.get('/states/', AuthenicteToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state ORDER BY state_id;`
  const StatesArray = await db.all(getStatesQuery)
  const UpdatedArrayTocamelCase = StatesArray.map(eachObj =>
    ConvertTocamelCase(eachObj),
  )
  response.send(UpdatedArrayTocamelCase)
})

// API 3
app.get('/states/:stateId/', AuthenicteToken, async (request, response) => {
  const {stateId} = request.params
  const getSpecificStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`
  const SpecificStateResponse = await db.get(getSpecificStateQuery)
  response.send(ConvertTocamelCase(SpecificStateResponse))
})

// API 4
app.post('/districts/', AuthenicteToken, async (request, response) => {
  const DistrictDetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = DistrictDetails
  const AddDistrictObjQuery = `INSERT INTO 
                                district (district_name,state_id,cases,cured,active,deaths)
                                VALUES (
                                  "${districtName}",
                                  ${stateId},
                                  ${cases},
                                  ${cured},
                                  ${active},
                                  ${deaths}
                                );`
  const DbResponse = await db.run(AddDistrictObjQuery)
  response.send('District Successfully Added')
})

const ConvertDistrictDetailsTocamelCase = eachobj => {
  return {
    districtId: eachobj.district_id,
    districtName: eachobj.district_name,
    stateId: eachobj.state_id,
    cases: eachobj.cases,
    cured: eachobj.cured,
    active: eachobj.active,
    deaths: eachobj.deaths,
  }
}

// API 5
app.get(
  '/districts/:districtId/',
  AuthenicteToken,
  async (request, response) => {
    const {districtId} = request.params
    const GetSpecificDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
    const SpecificDistrictResponse = await db.get(GetSpecificDistrictQuery)
    response.send(ConvertDistrictDetailsTocamelCase(SpecificDistrictResponse))
  },
)

// API 6
app.delete(
  '/districts/:districtId/',
  AuthenicteToken,
  async (request, response) => {
    const {districtId} = request.params
    const DeleteSpecificDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(DeleteSpecificDistrictQuery)
    response.send('District Removed')
  },
)

// API 7
app.put(
  '/districts/:districtId/',
  AuthenicteToken,
  async (request, response) => {
    const {districtId} = request.params
    const UpdateDistrictDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      UpdateDistrictDetails
    const UpdatingDistricDetailsQuery = `UPDATE district SET
                                        district_name = "${districtName}",
                                        state_id = ${stateId},
                                        cases = ${cases},
                                        cured = ${cured},
                                        active = ${active},
                                        deaths = ${deaths}
                                      WHERE district_id = ${districtId};`
    await db.run(UpdatingDistricDetailsQuery)
    response.send('District Details Updated')
  },
)

// API 8
app.get(
  '/states/:stateId/stats/',
  AuthenicteToken,
  async (request, response) => {
    const {stateId} = request.params
    const GetStatusQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district
                          WHERE state_id = ${stateId};`
    const StatusDbResponse = await db.get(GetStatusQuery)
    response.send(StatusDbResponse)
  },
)

module.exports = app
