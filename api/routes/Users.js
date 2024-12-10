const express = require("express");
const router = express.Router();

// db, dùng trong mọi trang
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

const fs = require('fs')
const path = require('path')
const parPath = path.join(__dirname, '..')
router.use('/uploads', express.static(path.join(parPath, 'uploads')))

// cái này chỉ dùng trong trang này thôi
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
router.use(cookieParser())
const bcryptSalt = bcrypt.genSaltSync(10)
const jwtSecret = 'fhdjskahdfjkdsafhjdshakjhf'


router.get('/', async (req,res) => {
    const allUsers = await prisma.user.findMany()
    res.json(allUsers)
})

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Kiểm tra nếu email đã tồn tại
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Email này đã được sử dụng. Vui lòng đăng nhập để truy cập.',
            });
        }

        // Tạo người dùng mới
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: bcrypt.hashSync(password, bcryptSalt),
            },
        });

        res.status(201).json({
            message: 'Registration successful!',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            },
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({
            error: 'Có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại.',
        });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Kiểm tra xem email có tồn tại không
        const userDoc = await prisma.user.findUnique({
            where: { email: email },
        });

        if (!userDoc) {
            return res.status(404).json({
                error: 'Email không tồn tại. Vui lòng đăng ký tài khoản mới.',
            });
        }

        // Kiểm tra trạng thái tài khoản
        if (userDoc.status === 'BLACKLISTED') {
            return res.status(403).json({
                error: 'Tài khoản của bạn đã bị khóa vĩnh viễn.',
                status: 'BLACKLISTED', // Trả về trạng thái BLACKLISTED
            });
        }

        // Kiểm tra mật khẩu
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (!passOk) {
            return res.status(401).json({
                error: 'Mật khẩu không đúng. Vui lòng thử lại.',
            });
        }

        // Tạo token JWT
        jwt.sign({ email: userDoc.email, id: userDoc.id }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                message: `${token}`,
                user: {
                    id: userDoc.id,
                    name: userDoc.name,
                    email: userDoc.email,
                    status: userDoc.status, // Trả về trạng thái tài khoản
                },
            });
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.' });
    }
});

router.get('/profile', (req,res) => {
    const {token} = req.cookies
    if(token) {
        jwt.verify(token, jwtSecret, {} , async (err, userData) => {
            if(err) throw err
            const {name, email, id, avatar, phone, zalo, status, createdAt, violationCount} = await prisma.user.findUnique({
                where: {id: userData.id}
            })
            res.json({name, email, id, avatar, phone, zalo, status, createdAt, violationCount})
        })
    } else {
        res.json(null) 
    }
})

router.post('/logout', (req, res) => {
    res.cookie('token', '').json(true)
})

async function cleanUnusedPhotos() {
    try {
        const photosPost = await prisma.placePhoto.findMany({
            select: { url: true }
        });

        const photosInvoice = await prisma.invoicePhoto.findMany({
            select: { url: true }
        });

        const photosAvatar = await prisma.user.findMany({
            select: { avatar: true }
        });

        // Hợp nhất các danh sách ảnh từ các bảng khác nhau
        const photoUrlsInDatabase = [
            ...photosPost.map(photo => path.basename(photo.url)), // Tên file từ placePhoto
            ...photosInvoice.map(photo => path.basename(photo.url)), // Tên file từ invoicePhoto
            ...photosAvatar
                .filter(photo => photo.avatar) // Loại bỏ null hoặc undefined
                .map(photo => path.basename(photo.avatar)) // Tên file từ user.avatar
        ];

        const uploadsFolder = path.join(parPath, 'uploads');
        // Tạo một danh sách các file ảnh hiện có trong thư mục uploads
        const filesInFolder = fs.readdirSync(uploadsFolder);

        // Lọc những file không có trong database
        const unusedFiles = filesInFolder.filter(file => !photoUrlsInDatabase.includes(file));

        // Xóa những file không còn được sử dụng
        unusedFiles.forEach(file => {
            const filePath = path.join(uploadsFolder, file);
            fs.unlinkSync(filePath);
            console.log(`Deleted unused photo: ${filePath}`);
        });

        console.log('Cleanup completed successfully!');
    } catch (error) {
        console.error('Error while cleaning up photos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

router.put('/change-avatar', async (req,res) => {
    const {id, updatedAvatar} = req.body
    const result = await prisma.user.update({
        where: {id: id},
        data: {avatar: updatedAvatar}
    })
    res.json(result)
    cleanUnusedPhotos()
})

router.post('/change-password', async (req, res) => {
    const { token } = req.cookies
    const { currentPassword, newPassword } = req.body;

    if(token) {
        jwt.verify(token, jwtSecret, {} , async (err, userData) => {
            if(err) throw err
            const user = await prisma.user.findUnique({
                where: {id: userData.id}
            })

            const isPasswordMatch = bcrypt.compareSync(currentPassword, user.password);
            if (!isPasswordMatch) {
                return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
            }

            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: bcrypt.hashSync(newPassword, bcryptSalt),
                },
            });

            res.status(200).json({ message: 'Mật khẩu đã được thay đổi thành công.', user: updatedUser });
            })
    } else {
        res.json(null) 
    }
});

router.post('/update-profile', async (req, res) => {
    const {token} = req.cookies
    const { name, phone, zalo } = req.body; // Dữ liệu cập nhật

    if(token) {
        let userId
        jwt.verify(token, jwtSecret, {} , async (err, userData) => {
            if(err) throw err
            userId = userData.id; 
        })

        try {
            // Tìm và cập nhật thông tin user
            const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: {
                    name: name || undefined,
                    phone: phone || undefined,
                    zalo: zalo || undefined,
                },
            });
    
            res.status(200).json({
                message: 'Thông tin cá nhân đã được cập nhật thành công.',
                user: updatedUser,
            });
        } catch (error) {
            res.status(500).json({
                message: 'Có lỗi xảy ra khi cập nhật thông tin cá nhân.',
                error: error.message,
            });
        }
    } else {
        res.json(null) 
    }
});

router.get('/check-hide-account', async (req, res) => {
    const { token } = req.cookies;

    jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }

        const userId = userData.id;

        try {
            // Kiểm tra nếu có Booking với status là RENTED liên quan đến user
            const pendingBookings = await prisma.booking.findFirst({
                where: {
                    OR: [
                        { renterId: userId, status: 'APPROVED' }, // Người này đang thuê
                        { place: { ownerId: userId }, status: 'APPROVED' }, // Người này là chủ trọ
                    ],
                },
            });

            if (pendingBookings) {
                return res.json({
                    result: false,
                    reason: 'Bạn đang có người thuê nên không thể ẩn tài khoản.',
                });
            }

            // Kiểm tra nếu người này có bài đăng nào đang bị report
            const reportedPlaces = await prisma.place.findFirst({
                where: {
                    ownerId: userId,
                    reports: {
                        some: {
                            status: 'PENDING', // Có báo cáo đang chờ xử lý
                        },
                    },
                },
            });

            if (reportedPlaces) {
                return res.json({
                    result: false,
                    reason: 'Bạn có bài đăng bị báo cáo chưa được xử lý.',
                });
            }

            return res.json({ result: true }); // Có thể xóa tài khoản
        } catch (error) {
            console.error('Error checking delete account condition:', error);
            return res.status(500).json({ message: 'Có lỗi xảy ra khi kiểm tra điều kiện xóa tài khoản.' });
        }
    });
});

router.get('/check-delete-account', async (req, res) => {
    const { token } = req.cookies;

    jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }

        const userId = userData.id;

        try {
            // Kiểm tra nếu có Booking với status là RENTED liên quan đến user
            const pendingBookings = await prisma.booking.findFirst({
                where: {
                    OR: [
                        { renterId: userId, status: 'APPROVED' }, // Người này đang thuê
                        { place: { ownerId: userId }, status: 'APPROVED' }, // Người này là chủ trọ
                    ],
                },
            });

            if (pendingBookings) {
                return res.json({
                    result: 'CANNOT_DELETE_YET',
                    reason: 'Tài khoản của bạn đang có booking.',
                });
            }

            // Kiểm tra nếu người này có bài đăng với report PENDING
            const pendingReports = await prisma.place.findFirst({
                where: {
                    ownerId: userId,
                    reports: {
                        some: { status: 'PENDING' },
                    },
                },
            });

            if (pendingReports) {
                return res.json({
                    result: 'CANNOT_DELETE_YET',
                    reason: 'Tài khoản của bạn có bài đăng đang bị báo cáo chưa được xử lý.',
                });
            }

            // Kiểm tra nếu người này có bài đăng với report DONE
            const doneReports = await prisma.place.findFirst({
                where: {
                    ownerId: userId,
                    reports: {
                        some: { status: 'DONE' },
                    },
                },
            });

            if (doneReports) {
                return res.json({
                    result: 'CANNOT_DELETE',
                    reason: 'Tài khoản của bạn có bài đăng bị báo cáo. Tài khoản không thể bị xóa.',
                });
            }

            // Nếu không vi phạm điều kiện nào, có thể xóa
            return res.json({ result: 'CAN_DELETE', reason: 'Tài khoản có thể bị xóa.' });
        } catch (error) {
            console.error('Error checking delete account condition:', error);
            return res.status(500).json({ message: 'Có lỗi xảy ra khi kiểm tra điều kiện xóa tài khoản.' });
        }
    });
});


//hoặc dài dòng hơn:))), nhưng cách này thì sẽ giúp check chính xác là ai. Đó kiểu z
// router.get('/check-delete-account', async (req, res) => {
//     const { token } = req.cookies;
//     // const {token} = req.body
//     try {
//       if (!token) {
//         return res.status(401).json({ message: 'Token không tồn tại.' });
//       }
  
//       // Xác thực token và lấy userId
//       const userData = jwt.verify(token, jwtSecret);
//       const userId = userData.id;
      
//     //   return res.json(userId)
//       // Kiểm tra từ bảng Place
//       const pendingBookings = await prisma.place.findFirst({
//         where: {
//           ownerId: userId, // Người dùng là chủ trọ
//           bookings: {
//             every: {
//               status: 'RENTED', // Booking liên quan có trạng thái PENDING
//             },
//           },
//         },
//       });
  
//       // Kiểm tra nếu có booking đang PENDING
//       if (pendingBookings) {
//         return res.json({ result: false }); // Không thể xóa tài khoản
//       }
  
//       // Kiểm tra nếu người dùng là renter với booking PENDING
//       const renterPending = await prisma.booking.findFirst({
//         where: {
//           renterId: userId,
//           status: 'RENTED',
//         },
//       });
  
//       if (renterPending) {
//         return res.json({ result: false }); // Không thể xóa tài khoản
//       }
  
//       return res.json({ result: true }); // Được phép xóa tài khoản
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({ message: 'Có lỗi xảy ra khi kiểm tra điều kiện xóa tài khoản.' });
//     }
// });

router.post('/delete-account', async (req, res) => {
    const { token } = req.cookies;
    const { password } = req.body;

    if (!token) {
        return res.status(401).json({ message: 'Token không tồn tại.' });
    }

    jwt.verify(token, jwtSecret, async (err, userData) => {
        if (err) {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }

        const userId = userData.id;

        try {
            // Lấy thông tin người dùng
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                return res.status(404).json({ message: 'Người dùng không tồn tại.' });
            }

            // Kiểm tra mật khẩu
            const isPasswordMatch = bcrypt.compareSync(password, user.password);
            if (!isPasswordMatch) {
                return res.status(400).json({ message: 'Mật khẩu không chính xác.' });
            }

            // Xóa tài khoản
            await prisma.user.delete({
                where: { id: userId },
            });

            // Xóa cookie và gửi phản hồi
            res.cookie('token', '', { httpOnly: true, secure: true, sameSite: 'strict' });
            return res.status(200).json({ message: 'Tài khoản đã được xóa thành công.' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Có lỗi xảy ra khi xóa tài khoản.' });
        }
    });
});

router.get('/profile/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const info = await prisma.user.findUnique({
        where: { id: parseInt(id, 10) },
        select: {
          name: true,
          avatar: true,
          phone: true,
          zalo: true,
          createAt: true, 
          violationCount: true,
          places: {
            include: {
                photos: true
            }
          }
        },
      });
  
      if (!info) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }
  
      res.json({ info });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Có lỗi xảy ra trong khi lấy thông tin người dùng' });
    }
});

router.post('/hide-account', async (req, res) => {
    const { token } = req.cookies;

    try {
        // Xác thực token
        const userData = jwt.verify(token, jwtSecret);
        if (!userData) {
            return res.status(403).json({ error: 'Token không hợp lệ' });
        }

        // Lấy trạng thái hiện tại của người dùng từ cơ sở dữ liệu
        const user = await prisma.user.findUnique({
            where: { id: userData.id },
        });

        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // Chuyển đổi trạng thái giữa ACTIVE và DEACTIVATED
        const newStatus = user.status === 'DEACTIVATED' ? 'ACTIVE' : 'DEACTIVATED';

        // Cập nhật trạng thái mới
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { status: newStatus },
        });

        res.status(200).json({
            message: `Tài khoản đã được chuyển sang trạng thái ${newStatus}.`,
            updatedUser: {
                id: updatedUser.id,
                name: updatedUser.name,
                status: updatedUser.status,
            },
        });
    } catch (error) {
        console.error('Error toggling account status:', error);
        return res.status(500).json({ error: 'Lỗi khi xử lý yêu cầu.' });
    }
});

module.exports = router