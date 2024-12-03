const express = require("express");
const router = express.Router();

// db, dùng trong mọi trang
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
router.use(cookieParser())
const bcryptSalt = bcrypt.genSaltSync(10)
const jwtSecret = 'fhdjskahdfjkdsafhjdshakjhf'

router.get('/', (req, res) => {

})

router.post('/register', async (req, res) => {
    const {email, password} = req.body
    const {tokenAdmin} = req.cookies

    if(tokenAdmin!=='') {
        jwt.verify(tokenAdmin, jwtSecret, {} , async (err, adminData) => {
            if(err) throw err
            const newAdmin = await prisma.admin.create({
                data: {
                    email,
                    createById: adminData.id,
                    password: bcrypt.hashSync(password, bcryptSalt)
                }
            })
            res.json(newAdmin)
        })
    } else {
        res.json('not')
    }
    
})

router.post('/login', async (req, res) => {
    const {email, password} = req.body
    const adminDoc = await prisma.admin.findUnique({
        where: {email: email}
    })
    if(adminDoc) {
        const passOk = bcrypt.compareSync(password, adminDoc.password)
        if(passOk) {
            jwt.sign({email:adminDoc.email, id:adminDoc.id}, jwtSecret, {}, (err, tokenAdmin) => {
                if(err) throw err
                res.cookie('tokenAdmin', tokenAdmin).json(adminDoc)
            })
        } else {
            res.status(422).json('pass not ok')
        }
    } else {
        res.json('not found')
    }
})

router.post('/logout', (req, res) => {
    res.cookie('tokenAdmin', '').json(true)
})

router.get('/profile', (req,res) => {
    const {tokenAdmin} = req.cookies
    if(tokenAdmin) {
        jwt.verify(tokenAdmin, jwtSecret, {} , async (err, adminData) => {
            if(err) throw err
            const {email, id} = await prisma.user.findUnique({
                where: {id: adminData.id}
            })
            res.json({email, id})
        })
    } else {
        res.json(null) 
    }
})

router.get('/get-places', async (req, res) => {
    try {
        const places = await prisma.place.findMany({
            include: {
                photos: true,
                perks: true,
                reports: {
                    include: {
                        reporter: { // Bao gồm thông tin người báo cáo
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                                phone: true,
                                zalo: true,
                            },
                        },
                    },
                },
                owner: { // Bao gồm thông tin chủ nhà
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        phone: true,
                        zalo: true,
                    },
                },
            },
        });
        res.json({ places });
    } catch (error) {
        console.error('Error fetching places:', error);
        res.status(500).json({ message: 'Có lỗi xảy ra khi lấy danh sách places.' });
    }
});


// Đổi trạng thái của Place thành DELETE và chuyển trạng thái các Report liên quan sang DONE
router.post('/delete-place/:placeId', async (req, res) => {
    const { placeId } = req.params;

    try {
        // Tìm kiếm Place
        const place = await prisma.place.findUnique({
            where: { id: parseInt(placeId) },
            include: { owner: true }, // Bao gồm thông tin chủ nhà
        });

        if (!place) {
            return res.status(404).json({ message: 'Place không tồn tại' });
        }

        // Cập nhật trạng thái của Place thành DELETE
        await prisma.place.update({
            where: { id: parseInt(placeId) },
            data: { status: 'DELETE' },
        });

        // Cập nhật trạng thái các Report liên quan thành DONE
        await prisma.report.updateMany({
            where: { placeId: parseInt(placeId), status: 'PENDING' },
            data: { status: 'DONE' },
        });

        // Xóa các booking có trạng thái PENDING
        await prisma.booking.deleteMany({
            where: { placeId: parseInt(placeId), status: 'PENDING' },
        });

        // Cập nhật các booking có trạng thái APPROVED thành RENTED
        await prisma.booking.updateMany({
            where: { placeId: parseInt(placeId), status: 'APPROVED' },
            data: { 
                status: 'RENTED',
                checkOut: new Date()
            },
        });

        // Tăng violationCount của chủ nhà và kiểm tra trạng thái BLACKLISTED
        const newViolationCount = place.owner.violationCount + 1;
        const newStatus = newViolationCount > 3 ? 'BLACKLISTED' : place.owner.status;

        const updatedOwner = await prisma.user.update({
            where: { id: place.ownerId },
            data: {
                violationCount: newViolationCount,
                status: newStatus,
            },
        });

        const isBlacklisted = newViolationCount > 3;
        if (isBlacklisted) {

            // Xóa tất cả places của user bị BLACKLISTED
            await prisma.place.deleteMany({
                where: { ownerId: place.ownerId },
            });
        }

        res.status(200).json({
            message: 'Place đã được chuyển sang trạng thái DELETE, các Report đã được xử lý, và Booking đã được cập nhật.',
            updatedPlace: {
                id: place.id,
                status: 'DELETE',
            },
            updatedOwner: {
                id: updatedOwner.id,
                violationCount: updatedOwner.violationCount,
                status: updatedOwner.status,
            },
        });
    } catch (error) {
        console.error('Error deleting place:', error);
        res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu.' });
    }
});

// Xóa tất cả các Report liên quan đến Place
router.post('/mark-place-normal/:placeId', async (req, res) => {
    const { placeId } = req.params;

    try {
        // Xóa tất cả các Report liên quan
        await prisma.report.deleteMany({
            where: { placeId: parseInt(placeId) },
        });

        // Lấy danh sách cập nhật
        const updatedPendingReports = await prisma.place.findMany({
            where: { status: 'SEE' }, // Nhà vẫn đang hiển thị (không phải DELETE)
        });

        const updatedNormalPlaces = await prisma.place.findMany({
            where: { status: 'SEE' }, // Nhà bình thường (không bị báo cáo)
        });

        res.status(200).json({
            message: 'Tất cả các Report liên quan đã được xóa.',
            updatedPendingReports,
            updatedNormalPlaces,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu.' });
    }
});


module.exports = router