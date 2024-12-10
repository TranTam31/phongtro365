const express = require("express");
const router = express.Router();

// db, dùng trong mọi trang
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
router.use(cookieParser())
const jwtSecret = 'fhdjskahdfjkdsafhjdshakjhf'

const { addMonths } = require('date-fns');

const createNotification = async (userId, type, message, placeId = null) => {
    let parsedPlaceId
    if(typeof placeId === 'number') parsedPlaceId = placeId
    else if(typeof placeId !== 'number') parsedPlaceId = parseInt(placeId)

    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          message,
          placeId: parsedPlaceId,  // Lưu placeId nếu có
        },
      });
    } catch (error) {
      console.error("Error creating notification", error);
    }
};

// router.post('/', async (req, res) => {
//     const {token} = req.cookies
//     let renterId = null
//     jwt.verify(token, jwtSecret, {}, (err, userData) => {
//         if(err) throw err
//         renterId = userData.id
//     })
//     const {placeId} = req.body

//     const newBooking = await prisma.booking.create({
//         data: {
//             placeId, renterId,
//         }
//     })
//     res.json(newBooking)
// })

router.post('/', async (req, res) => {
    const { token } = req.cookies;
    let renterId = null;

    // Lấy renterId từ token
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        renterId = userData.id;
    });

    const { placeId } = req.body;

    try {
        // Tạo booking mới
        const newBooking = await prisma.booking.create({
            data: {
                placeId,
                renterId,
            }
        });

        // Tìm chủ sở hữu của place
        const place = await prisma.place.findUnique({
            where: { id: placeId },
            include: {
                owner: true, // Giả sử trường 'owner' là chủ sở hữu của place
            }
        });

        // Kiểm tra nếu có owner, tạo thông báo
        if (place && place.owner) {
            const ownerId = place.owner.id;

            // Tạo thông báo cho chủ sở hữu
            const message = `Có một booking mới cho ngôi nhà này của bạn.`;
            await createNotification(ownerId, "Booking", message, placeId);
        }

        res.json(newBooking);
    } catch (error) {
        console.error("Error creating booking", error);
        res.status(500).json({ message: "Có lỗi xảy ra khi tạo booking" });
    }
}); 

router.post('/cancel-booking', async (req, res) => {
    const { token } = req.cookies;
    let renterId = null;

    // Xác thực token và lấy renterId (người dùng)
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        renterId = userData.id;

        // Lấy placeId từ request body
        const { placeId } = req.body;

        // Tìm booking của người dùng (renterId) và placeId
        const booking = await prisma.booking.findFirst({
            where: {
                renterId,
                placeId,
                status: "PENDING"
            },
        });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Xóa booking
        await prisma.booking.delete({
            where: {
                id: booking.id, // Xóa dựa trên id của booking
            },
        });

        // Trả về phản hồi thành công
        res.json({ message: 'Booking canceled successfully' });
    });
});

router.get('/', (req, res) => {
    const {token} = req.cookies
    // const {token} = req.body
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if(err) throw err
        const {id} = userData
        const bookings = await prisma.booking.findMany({
            where: {
                renterId: parseInt(id, 10)
            },
            include: {
                place: {
                    include: {
                        photos: true, // Lấy các ảnh từ bảng photos
                        perks: true,   // Lấy các perks từ bảng perks
                        bookings: true
                    }
                }
            }
        })
        res.json(bookings)
    })
})


router.post('/accept', async (req, res) => {
    const { token } = req.cookies;
    const { bookingId, placeId } = req.body;

    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });

        try {
            // Bước 1: Lấy `duration` của hợp đồng từ `Place`
            const place = await prisma.place.findUnique({
                where: { id: parseInt(placeId, 10) },
                select: { duration: true }
            });

            if (!place) {
                return res.status(404).json({ error: 'Place not found' });
            }

            // Tính `checkOut` dựa trên `duration`
            const checkOutDate = addMonths(new Date(), place.duration);

            // Bước 2: Lấy thông tin của booking đã được chọn (APPROVED)
            const approvedBooking = await prisma.booking.findUnique({
                where: { id: bookingId },
                select: { renterId:true, placeId:true }
            });

            if (!approvedBooking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            // Bước 3: Đổi trạng thái của `booking` đã chọn thành `APPROVED` và cập nhật `checkOut`
            await prisma.booking.update({
                where: { id: bookingId },
                data: {
                    status: 'APPROVED',
                    checkOut: checkOutDate
                }
            });

            // Tạo thông báo cho người được duyệt
            const approvedMessage = `Chúc mừng! Chủ nhà đã đồng ý cho bạn thuê nhà! Ngày check-out là ${checkOutDate.toLocaleDateString()}.`;
            await createNotification(approvedBooking.renterId, 'Đồng ý Booking', approvedMessage, placeId);

            // Bước 4: Kiểm tra và xóa các booking có `status` là `PENDING` cùng `placeId`
            // Lấy các booking `PENDING` nhưng không phải booking đã được duyệt
            const rejectedBookings = await prisma.booking.findMany({
                where: {
                    placeId: parseInt(placeId, 10),
                    status: 'PENDING',
                    id: { not: bookingId } // Loại trừ booking đã được duyệt
                },
                select: { renterId:true, id:true }
            });

            // Nếu có rejectedBookings thì tiếp tục xử lý
            if (rejectedBookings.length > 0) {
                // Cập nhật trạng thái các booking bị từ chối và tạo thông báo
                for (const booking of rejectedBookings) {
                    // Cập nhật trạng thái của các booking bị từ chối
                    await prisma.booking.update({
                        where: { id: booking.id },
                        data: {
                            status: 'REJECTED'
                        }
                    });

                    // Tạo thông báo cho các booking bị từ chối
                    const rejectedMessage = `Your booking for this place has been rejected. Please check other available options.`;
                    await createNotification(booking.renterId, 'Booking Rejected', rejectedMessage, placeId);
                }
            }

            res.json({ message: 'Booking has been approved, checkOut date set, other pending bookings are removed, and notifications sent.' });

        } catch (error) {
            console.error("Error approving booking:", error);
            res.status(500).json({ error: 'Something went wrong while approving booking.' });
        }
    });
});

router.post('/delete-all-booking', async (req, res) => {
    const { token } = req.cookies;
    const { id } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });

        try {
            // Tìm tất cả booking có trạng thái 'PENDING' của placeId tương ứng
            const pendingBookings = await prisma.booking.findMany({
                where: {
                    placeId: id,
                    status: 'PENDING'
                },
                select: {
                    renterId: true,
                    placeId: true,
                    id: true
                }
            });

            if (pendingBookings.length > 0) {
                // Cập nhật trạng thái của tất cả các booking PENDING thành REJECTED
                await prisma.booking.updateMany({
                    where: {
                        placeId: id,
                        status: 'PENDING'
                    },
                    data: {
                        status: 'REJECTED'
                    }
                });
                // Gửi thông báo cho từng renterId bị từ chối booking
                for (const booking of pendingBookings) {
                    const message = `Chủ nhà này đã không đồng ý cho bạn thuê nhà này.`;
                    await createNotification(booking.renterId, 'Từ chối booking', message, booking.placeId);
                }

                res.json({ message: 'All pending bookings have been rejected and notifications sent.' });
            } else {
                res.json({ message: 'No pending bookings found for this place.' });
            }

        } catch (error) {
            console.error('Error canceling all bookings:', error);
            res.status(500).json({ error: 'Something went wrong while canceling all bookings.' });
        }
    });
});

router.post('/invoice', async (req, res) => {
    const { bookingId, title, description, addedPhotos } = req.body;

    try {
        // Bước 1: Lấy thông tin của booking để lấy renterId
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: {
                renterId: true, // Lấy renterId để gửi thông báo
                placeId: true    // Lấy placeId nếu cần dùng cho thông báo
            }
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Bước 2: Tạo hóa đơn mới
        const newInvoice = await prisma.invoice.create({
            data: {
                booking: { connect: { id: bookingId } },
                title,
                description,
                photos: {
                    create: addedPhotos.map(photo => ({ url: photo })), // Tạo các bản ghi PlacePhoto
                },
            }
        });

        // Bước 3: Tạo thông báo cho người thuê (renterId)
        const message = `Hóa đơn mới. Tiêu đề: "${title}".`;

        // Gửi thông báo cho renterId
        await createNotification(booking.renterId, 'Hóa đơn', message, booking.placeId);

        // Bước 4: Trả về kết quả
        res.json(newInvoice);
    } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ error: 'Something went wrong while creating invoice.' });
    }
});


router.get('/getinvoices/:id', async (req,res) => {
    const { id } = req.params;
    const invoices = await prisma.invoice.findMany({
        where: {bookingId: parseInt(id, 10)},
        include: {
            photos: true
        }
    })
    res.json(invoices)
})

router.put('/continue-rent', async (req, res) => {
    const { bookingId, placeId } = req.body;

    try {
        // Lấy thông tin `duration` của `place`
        const place = await prisma.place.findUnique({
            where: { id: parseInt(placeId,10) },
            select: { duration: true } // Chỉ lấy `duration`
        });

        if (!place) {
            return res.status(404).json({ error: 'Place not found' });
        }

        // Lấy thông tin `checkOut` hiện tại của booking
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: { checkOut: true }
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Tính `checkOut` mới
        const newCheckOut = addMonths(new Date(booking.checkOut), place.duration);

        // Cập nhật `checkOut` mới
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                checkOut: newCheckOut
            }
        });

        // Bước 3: Xóa các booking có `status` là `PENDING` cùng `placeId`
        await prisma.booking.deleteMany({
            where: {
                placeId: parseInt(placeId,10),
                status: 'PENDING'
            }
        })

        res.json({ message: 'Booking updated successfully', updatedBooking });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while updating the booking.' });
    }
});

router.put('/not-continue-rent', async (req, res) => {
    const {bookingId} = req.body
    const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            isContinue: true
        }
    });
    res.json({ message: 'Booking updated successfully', updatedBooking });
})

// router.put('/not-rent-request', async (req, res) => {
//     const {bookingId} = req.body
//     const result = await prisma.booking.update({
//         where: { id: bookingId },
//         data: {
//             status: 'WAIT'
//         }
//     })
//     res.json(result)
// })

router.put('/not-rent-request', async (req, res) => {
    const { bookingId } = req.body;

    try {
        // Bước 1: Lấy thông tin của booking (cần renterId để gửi thông báo cho chủ nhà)
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                place: {
                    select: {
                        ownerId: true
                    }
                }
            }
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Bước 2: Cập nhật trạng thái của booking thành 'WAIT'
        const result = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: 'WAIT',
            },
        });

        // Bước 3: Tạo thông báo cho chủ nhà (người thuê yêu cầu dừng thuê)
        const message = `Người thuê nhà đang yêu cầu dừng thuê nhà này.`;

        await createNotification(booking.place.ownerId, 'Stop booking', message, booking.placeId);

        // Trả về kết quả sau khi cập nhật thành công
        res.json(result);
    } catch (error) {
        console.error('Error handling not rent request:', error);
        res.status(500).json({ error: 'Something went wrong while processing your request.' });
    }
});

router.put('/undo-not-rent-request', async (req, res) => {
    const {bookingId} = req.body
    const result = await prisma.booking.update({
        where: { id: bookingId },
        data: {
            status: 'APPROVED'
        }
    })
    res.json(result)
})

// router.put('/not-rent-response', async (req, res) => {
//     const {bookingId} = req.body
//     const result = await prisma.booking.update({
//         where: { id: bookingId },
//         data: {
//             status: 'RENTED',
//             checkOut: new Date()
//         }
//     })
//     res.json(result)
// })

router.put('/not-rent-response', async (req, res) => {
    const { bookingId } = req.body;

    try {
        // Bước 1: Lấy thông tin của booking để lấy renterId và placeId
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            select: {
                renterId: true,  // Lấy renterId để gửi thông báo cho người thuê
                placeId: true,    // Lấy placeId để lấy thông tin chủ nhà
            }
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Bước 2: Cập nhật trạng thái của booking thành 'RENTED' và cập nhật checkOut
        const result = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: 'RENTED',
                checkOut: new Date(),  // Bạn có thể thay đổi thời gian check-out theo yêu cầu
            }
        });

        // Bước 3: Gửi thông báo cho renterId rằng chủ nhà đã xác nhận
        const message = `Chủ nhà đã xác nhận yêu cầu dừng thuê phòng của bạn`;

        await createNotification(booking.renterId, 'Xác nhận dừng thuê', message, booking.placeId);

        // Trả về kết quả sau khi cập nhật thành công
        res.json(result);
    } catch (error) {
        console.error('Error handling not rent response:', error);
        res.status(500).json({ error: 'Something went wrong while processing your response.' });
    }
});

module.exports = router;