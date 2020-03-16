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

const { query } = require('graphqurl');

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.post('/authenticate', (req, res) => {
    const getUsername = req.body.username
    const getPassword = req.body.password

    connection.query(`SELECT * FROM users WHERE username = '${getUsername}' AND password = '${getPassword}'`, (err, data) => {
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
                if(data[0].role === 0) {
                    res.json({
                        code: '00201',
                        message: 'ไม่มีสิทธ์เข้าระบบ' // Authen ผ่าน แต่ไม่มีสิทธิ์เข้าระบบ
                    })
                } else {
                    res.json({
                        code: '00200',
                        token: data[0].token,
                        role: data[0].role // Authen ผ่าน
                    })
                }
            }
        }
    })
})

app.post('/logout', (req, res) => {
    const getUsername = req.body.username
    const getPassword = req.body.password

    connection.query(`UPDATE users SET token = '' WHERE users.username = '${getUsername}' AND users.password = '${getPassword}'`, (err, data) => {
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

app.get('/token/verify/:username/:password', (req, res) => {
    const token = req.headers['authorization']
    const SECRET = req.params.password

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
    const getPassword = req.body.password

    const payload = {
        userId: getUsername,
        time: new Date().valueOf()
    }
    const SECRET = getPassword
    const options = {
        expiresIn: '6hr'
    }
    const token = jwt.sign(payload, SECRET, options)
    
    connection.query(`UPDATE users SET token = '${token}' WHERE users.username = '${getUsername}' AND users.password = '${getPassword}'`, (err, data) => {
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
    const username = req.params.username
    const token = req.headers['authorization']

    connection.query(`SELECT * FROM users WHERE username = '${username}' AND token = '${token}'`, (err, data) => {
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
                    message: 'ไม่พบข้อมูล' // ไม่พบข้อมูล
                })
            } else {
                const SECRET = data[0].password

                try {
                    jwt.verify(token, SECRET)
            
                    // token สามารถใช้ได้
                    res.json({
                        code: '00200',
                        data: data[0]
                    })
                } catch {
                    // token หมดอายุแล้ว
                    res.json({
                        code: '00401',
                        message: 'Token has been expired'
                    })
                }
            }
        }
    })
})

/* GraphQL */
const endpoint = 'http://192.168.1.24:8080/v1/graphql'
app.get('/getsetting', (req, res) => {
    let setting = {
        rank: [],
        born: [],
        groups: [],
    }

    query(
        {
            query: `query Ranks {
                hr_ranks(order_by: {rank_order: asc}, where: {id: {_lte: "34", _neq: "19"}, _and: {id: {_gte: "3", _neq: "31"}}}) {
                  id
                  name
                  rank_order
                  short_name
                  rank_type_name
                  rank_type_id
                  status
                }
            }`,
            endpoint: endpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        }
    ).then((response) => {
        setting.rank = response.data.hr_ranks

        query(
            {
                query: `query BornForms {
                    hr_born_froms(order_by: {id: asc}) {
                        id
                        short_name
                        name
                    }
                }`,
                endpoint: endpoint,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            }
        ).then((response) => {
            setting.born = response.data.hr_born_froms

            query(
                {
                    query: `query SoldierGroups {
                        hr_soldier_groups(order_by: {order_no: asc}) {
                            id
                            name
                            order_no
                            short_name
                        }
                    }`,
                    endpoint: endpoint,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            ).then((response) => {
                setting.groups = response.data.hr_soldier_groups

                res.json({
                    code: '00200',
                    setting: setting
                })
            })
            .catch((error) => {
                console.error(error)
            })
        })
        .catch((error) => {
            console.error(error)
        })
    })
    .catch((error) => {
        // console.error(error)

        res.json({
            code: '00400',
            message: 'ไม่สามารถเชื่อมต่อ Hasura GraphQL ได้'
        })
    })
})

app.post('/getpersons', (req, res) => {
    const ranksId = req.body.ranksId > 0 ? `ranks_id: {_eq: ${req.body.ranksId}},` : "" // 11
    const nameTh = req.body.nameTh !== '' ? `name_th: {_like: "%${req.body.nameTh}%"},` : "" // "%อภิรัก%"
    const surnameTh = req.body.surnameTh !== '' ? `surname_th: {_like: "%${req.body.surnameTh}%"},` : "" // "%สุวรรณ%"
    const bornFromsId = req.body.bornFromsId > 0 ? `born_froms_id: {_eq: ${req.body.bornFromsId}},` : "" // 11
    const soldierGroupsId = req.body.soldierGroupsId > 0 ? `soldier_groups_id: {_eq: ${req.body.soldierGroupsId}},` : "" // 16
    const positionName = req.body.positionName !== '' ? `position_name: {_like: "%${req.body.positionName}%"},` : "" // "%ประจำแผนก%"

    query(
        {
            query: `query DopGeneralProfile {
                hr_general_profiles(
                    where: {
                        departments_id: {_eq: 1},
                        ${ranksId}
                        ${nameTh}
                        ${surnameTh}
                        ${bornFromsId}
                        ${soldierGroupsId}
                        ${positionName}
                    }, 
                    order_by: {
                        join_ranks: {rank_order: asc}
                    }
                ) {
                    name_th
                    surname_th
                    birthdate
                    join_ranks {
                        short_name
                        name
                        rank_order
                    }
                    join_born_froms {
                        name
                        short_name
                    }
                    join_soldier_groups {
                        short_name
                    }
                    position_name
                    sex
                    id_card13
                }
            }`,
            endpoint: endpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        }
    ).then((response) => {
        res.json({
            code: '00200',
            data: response.data.hr_general_profiles
        })
    })
    .catch((error) => {
        // console.error(error)

        res.json({
            code: '00400',
            message: 'ไม่สามารถเชื่อมต่อ Hasura GraphQL ได้'
        })
    })
})

app.post('/getpersondetail', (req, res) => {
    const idCard13 = req.body.idCard13

    query(
        {
            query: `query {
                hr_general_profiles(
                    where: {
                        id_card13: {_eq: "${idCard13}"}
                    }, 
                    order_by: {join_ranks: {rank_order: asc}
                }) {
                    name_th
                    surname_th
                    id_card13
                    join_ranks {
                        name
                        short_name
                        rank_order
                    }
                    join_born_froms {
                        name
                        short_name
                    }
                    join_soldier_groups {
                        name
                        short_name
                    }
                    birthdate
                    birth_place
                    email
                    active_date
                    military_skill
                    sex
                    contain
                    contain_date
                    father_name
                    father_surname
                    mother_name
                    mother_surname
                    nation
                    nationality
                    position_name
                    register_date
                    soldier_number
                    telephone_number
                    preparatory_no
                    crma_no
                }
            }`,
            endpoint: endpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        }
    ).then((response) => {
        res.json({
            code: '00200',
            data: response.data.hr_general_profiles
        })
    })
    .catch((error) => {
        // console.error(error)

        res.json({
            code: '00400',
            message: 'ไม่สามารถเชื่อมต่อ Hasura GraphQL ได้'
        })
    })
})

app.post('/getperson-general-education', (req, res) => {
    const idCard13 = req.body.idCard13

    query(
        {
            query: `query EducationHistories {
                hr_edu_general_histories(
                    where: {
                        id_card13: {
                            _eq: "${idCard13}"}
                        },
                        order_by: {
                            graduated_date: desc
                        })
                    {
                    join_edu_general_cert {
                        cert_name
                        join_edu_general_level {
                            level_name
                        }
                    }
                    join_general_major {
                        major_name
                    }
                    join_edu_general_institute {
                        institute_name
                        join_countrys {
                            name
                        }
                    }
                    graduated_result
                    graduated_date
                }
            }`,
            endpoint: endpoint,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        }
    ).then((response) => {
        res.json({
            code: '00200',
            data: response.data.hr_edu_general_histories
        })
    })
    .catch((error) => {
        // console.error(error)

        res.json({
            code: '00400',
            message: 'ไม่สามารถเชื่อมต่อ Hasura GraphQL ได้'
        })
    })
})

app.listen(PORT, () => {
    console.log(`> Server is running on port : ${PORT}`)
})