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
                let returnDate = []

                data.map((item, index) => {
                    returnDate.push({
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
                    data: returnDate // Authen ผ่าน
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
                    console.log('123')
                    res.json({
                        code: '00404',
                        message: 'ไม่พบข้อมูล' // ไม่พบ username --> link ไม่ถูกต้อง
                    })
                    return 0
                }

                connection.query(`SELECT * FROM agents WHERE token = '${token}'`, (err, data) => {
                    if(err) {
                        // res.send(err)
                        res.json({
                            code: 'db is out of service',
                            message: 'ฐานข้อมูลยังไม่เปิดให้บริการ'
                        })
                    } else {
                        if(data.length === 0) {
                            res.json({
                                code: 'loggedout',
                                message: 'ออกจากระบบหรือมีการเข้าสู่ระบบจากอุปกรณ์อื่น' // ไม่พบ token --> ถูก logged out ไปแล้ว หรือถูกเข้าระบบจากอุปกรณ์อื่น
                            })
                        } else {
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
            }
        }
    })
})

app.listen(PORT, () => {
    console.log(`> Server is running on port : ${PORT}`)
})