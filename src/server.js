const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const mysql = require('mysql')

const app = express()
const PORT = process.env.PORT || 8080
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'qwaszx',
    database: 'dop_welfare_house'
})

// connection.connect((err) => {
//     err ? console.log(err) : console.log(connection)
// })

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/getallagents', (req, res) => {
    connection.query(`SELECT * FROM agents ORDER BY agents.rank_order ASC`, (err, data) => {
        if(err) {
            console.log(err)
            res.json({
                code: '00401',
                message: 'ไม่สามารถเข้าถึงฐานข้อมูล' // Access denied to DB or out of service
            })
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00404',
                    message: 'ไม่พบข้อมูล' // Authen ไม่ผ่าน
                })
            } else {
                let returnData = []

                data.map((item, index) => {
                    returnData.push({
                        id: item.id,
                        username: item.username,
                        position: item.position,
                        fullname: `${item.rank} ${item.name} ${item.lastname}`,
                        inActive: item.token !== '' ? true : false,
                        token: item.token
                    })

                    return 0
                })

                res.json({
                    code: '00200',
                    data: returnData // Authen ผ่าน
                })
            }
        }
    })
})

app.post('/authenticate', (req, res) => {
    const getUsername = req.body.username
    // const getPassword = req.body.password

    connection.query(`SELECT * FROM agents WHERE username = '${getUsername}'`, (err, data) => {
        if(err) {
            console.log(err)
            res.json({
                code: '00401',
                message: 'ไม่สามารถเข้าถึงฐานข้อมูล' // Access denied to DB or out of service
            })
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00404',
                    message: 'ไม่พบข้อมูล' // Authen ไม่ผ่าน
                })
            } else {
                res.json({
                    code: '00200',
                    token: data[0].token,
                })
            }
        }
    })
})

app.post('/logout', (req, res) => {
    const getUsername = req.body.username

    connection.query(`UPDATE agents SET token = '' WHERE agents.username = '${getUsername}'`, (err, data) => {
        if(err) {
            res.send(err)
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00000',
                    message: 'ไม่สามารถบันทึกข้อมูลได้'
                })
            } else {
                res.json({
                    code: '00200',
                    message: 'บันทึกเรียบร้อย',
                })
            }
        }
    })
})

app.get('/token/verify/:username', (req, res) => {
    const token = req.headers['authorization']
    const SECRET = req.params.username

    try {
        const payload = jwt.verify(token, SECRET)

        // token สามารถใช้ได้
        res.json({
            code: '00200',
            data: payload
        })
    } catch {
        // แสดงว่า token หมดอายุแล้ว
        res.json({
            code: '00401',
            message: 'Token has been expired'
        })
    }
})

app.post('/token/save', (req, res) => {
    //--- ขอ token ใหม่ ---//
    const getUsername = req.body.username

    const payload = {
        userId: getUsername,
        time: new Date().valueOf()
    }
    const SECRET = getUsername
    const options = {
        expiresIn: '6hr'
    }
    const token = jwt.sign(payload, SECRET, options)
    
    connection.query(`UPDATE agents SET token = '${token}' WHERE agents.username = '${getUsername}'`, (err, data) => {
        if(err) {
            res.send(err)
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00000',
                    message: 'ไม่สามารถบันทึกข้อมูลได้'
                })
            } else {
                res.json({
                    code: '00200',
                    message: 'บันทึกเรียบร้อย',
                    token: token
                })
            }
        }
    })
})

// ส่วนที่ 2 สำหรับกรรมการแต่ละท่าน ใช้ลงคะแนนผู้เสนอขอบ้านพัก

app.get('/getdata/:username', (req, res) => {
    const username = req.headers['username']
    const token = req.headers['authorization']

    connection.query(`SELECT * FROM agents WHERE username = '${username}'`, (err, data) => {
        if(err) {
            // res.send(err)
            res.json({
                code: 'db is out of service',
                message: 'ฐานข้อมูลยังไม่เปิดให้บริการ'
            })
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00404',
                    message: 'ไม่พบข้อมูล' // ไม่พบ username --> link ไม่ถูกต้อง
                })
            } else {
                if(data[0].token === '') {
                    res.json({
                        code: 'loggedout',
                        message: 'ออกจากระบบหรือมีการเข้าสู่ระบบจากอุปกรณ์อื่น' // ไม่พบ token --> ถูก logged out ไปแล้ว หรือถูกเข้าระบบจากอุปกรณ์อื่น
                    })
                    return 0
                }
                
                if(data[0].token !== token) {
                    res.json({
                        code: 'loggedout',
                        message: 'ออกจากระบบหรือมีการเข้าสู่ระบบจากอุปกรณ์อื่น' // token ถูกเปลี่ยน -> ออนไลน์อยู่ที่อุปกรร์อื่น
                    })
                    return 0
                }

                const SECRET = data[0].username
                try {
                    jwt.verify(token, SECRET)
            
                    // token สามารถใช้ได้
                    res.json({
                        code: '00200',
                        data: data[0]
                    })
                } catch {
                    // token หมดอายุแล้ว
                    connection.query(`UPDATE agents SET token = '' WHERE agents.username = '${username}'`, (err, data) => {
                        if(err) {
                            res.send(err)
                        } else {
                            if(data.length === 0) {
                                res.json({
                                    code: '00000',
                                    message: 'ไม่สามารถบันทึกข้อมูลได้'
                                })
                            } else {
                                // message: set token to ''

                                res.json({
                                    code: '00401',
                                    message: 'Token has been expired'
                                })
                            }
                        }
                    })
                }
            }
        }
    })
})

app.get('/verify/approvement', (req, res) => {
    const token = req.headers['authorization']
    const agentId = req.headers['agent_id']
    const arrQuery = [
        'น',
        'ป'
    ]
    let result = {
        group_0: 0,
        group_1: 0
    }

    arrQuery.map((toQuery, index) => {
        connection.query(`SELECT scores.agent_id, scores.candidate_id, candidates.salary_group, scores.is_approved FROM scores INNER JOIN candidates ON candidates.id=scores.candidate_id WHERE scores.agent_id = ${agentId} AND scores.is_approved = 0 AND candidates.salary_group LIKE '%${toQuery}%'`, (err, data) => {
            if(err) {
                console.log(err)
                res.json({
                    code: '00401',
                    message: 'ไม่สามารถเข้าถึงฐานข้อมูล' // Access denied to DB or out of service
                })
            } else {
                if(data.length === 0) {
                    // approved ไปหมดแล้ว -> จึงหา scores.is_approved = 0 ไม่เจอ อิอิ
                    result = {
                        ...result,
                        [`row_${index}`]: 1
                    }
                } else {
                    // ยัง approved ไม่หมด
                }

                if(index+1 === arrQuery.length) {
                    res.json({
                        code: '00200',
                        message: 'เชื่อมต่อสำเร็จ',
                        data: result
                    })
                }
            }
        })
    })
})

app.get('/getcandidates/:type', (req, res) => {
    const type = req.params.type
    const token = req.headers['authorization']
    const agentId = req.headers['agent_id']
    let returnData = []
    let arrQuery = []
    if(type === '1') {
        arrQuery = [
            'น.4-5',
            'น.2-3',
            'น.1'
        ]
    } else {
        arrQuery = [
            'ป.2-3',
            'ป.1'
        ]
    }

    arrQuery.map((toQuery, index) => {
        connection.query(`SELECT candidates.id, candidates.rank, candidates.fname, candidates.lname, candidates.salary_group, scores.agent_id, scores.candidate_id, scores.score_first, scores.score_second, scores.score_third, scores.score_fourth, scores.score_fifth, scores.is_approved FROM candidates INNER JOIN scores ON candidates.id=scores.candidate_id WHERE candidates.salary_group LIKE '%${toQuery}%' AND scores.agent_id = ${agentId}`, (err, data) => {
            if(err) {
                console.log(err)
                res.json({
                    code: '00401',
                    message: 'ไม่สามารถเข้าถึงฐานข้อมูล' // Access denied to DB or out of service
                })
            } else {
                if(data.length === 0) {
                    returnData = [...returnData, []]
                    console.log('ไม่พบข้อมูล')
                } else {
                    returnData = [...returnData, data]

                    if(index+1 === arrQuery.length) {
                        res.json({
                            code: '00200',
                            message: 'เชื่อมต่อสำเร็จ',
                            data: returnData
                        })
                    }
                }
            }
        })

        return 0
    })
})

app.post('/candidates/score/save', (req, res) => {
    const groupData = req.body.groupData

    Object.keys(groupData).map((person, index) => {
        const getPerson = groupData[person]
        const score_first = getPerson.score_first !== null ? getPerson.score_first : 0
        const score_second = getPerson.score_second !== null ? getPerson.score_second : 0
        const score_third = getPerson.score_third !== null ? getPerson.score_third : 0
        const score_fourth = getPerson.score_fourth !== null ? getPerson.score_fourth : 0
        const score_fifth = getPerson.score_fifth !== null ? getPerson.score_fifth : 0
        const agent_id = getPerson.agent_id
        const candidate_id = getPerson.candidate_id

        connection.query(`UPDATE scores SET score_first = ${score_first}, score_second = ${score_second}, score_third = ${score_third}, score_fourth = ${score_fourth}, score_fifth = ${score_fifth}, is_approved = 1 WHERE agent_id = ${agent_id} AND candidate_id = ${candidate_id}`, (err, data) => {
            if(err) {
                res.send(err)
            } else {
                if(data.length === 0) {
                    res.json({
                        code: '00000',
                        message: 'ไม่มีข้อมูลที่ถูกบันทึก'
                    })
                } else {
                    if(index+1 === Object.keys(groupData).length) {
                        res.json({
                            code: '00200',
                            message: 'บันทึกเรียบร้อย',
                        })
                    }
                }
            }
        })

        return 0
    })
})

// ส่วนที่ 3 สำหรับเลขการประชุม ใช้นำเสนอสรุปผลการให้คะแนนของกรรมการ

app.get('/candidates/score', (req, res) => {
    const token = req.headers['authorization']

    connection.query(`SELECT candidates.id, candidates.rank, candidates.fname, candidates.lname, candidates.salary_group, scores.agent_id, scores.candidate_id, scores.is_approved, scores.score_first+scores.score_second+scores.score_third+scores.score_fourth+scores.score_fifth as total FROM candidates INNER JOIN scores ON candidates.id=scores.candidate_id`, (err, data) => {
        if(err) {
            console.log(err)
            res.json({
                code: '00401',
                message: 'ไม่สามารถเข้าถึงฐานข้อมูล' // Access denied to DB or out of service
            })
        } else {
            if(data.length === 0) {
                res.json({
                    code: '00400',
                    message: 'ไม่พบข้อมูลกรรมการ'
                })
            } else {
                res.json({
                    code: '00200',
                    message: 'อ่านข้อมูลสำเร็จ',
                    data: data
                })
            }
        }
    })
})

app.listen(PORT, () => {
    console.log(`> Server is running on port : ${PORT}`)
})