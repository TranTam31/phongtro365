import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Perks from '../Perks'
import axios from 'axios'

function PlacesPage() {
    const {action} = useParams()
    const [title, setTitle] = useState('')
    const [address, setAddress] = useState('')
    const [addedPhotos, setAddedPhotos] = useState([])
    const [photoLink, setPhotoLink] = useState('')
    const [description, setDescription] = useState('')
    const [perks, setPerks] = useState([])
    const [extraInfo, setExtraInfo] = useState('')
    const [checkIn, setCheckIn] = useState('')
    const [checkOut, setCheckOut] = useState('')
    const [maxGuests, setMaxGuests] = useState(1)
    function inputHeader(text) {
        return(
            <h2 className='text-2xl mt-4'>{text}</h2>
        )
    }
    function inputDescription(text) {
        return(
            <p className='text-gray-500 text-sm'>{text}</p>
        )
    }
    function preInput(header, description) {
        return (
            <>
                {inputHeader(header)}
                {inputDescription(description)}
            </>
        )
    }
    async function addPhotoByLink(ev) {
        ev.preventDefault()
        const {data: filename} = await axios.post('/post/upload-by-link', {link: photoLink})
        setAddedPhotos(prev => {
            return [...prev, filename]
        })
        setPhotoLink('')
    }

    function uploadPhoto(ev) {
        const files = ev.target.files
        const data = new FormData()
        for(let i = 0; i < files.length; i++) {
            data.append('photos', files[i])
        }
        axios.post('/post/upload', data, {
            headers: {'Content-type': 'multipart/form-data'}
        }).then(response => {
            const {data: filenames} = response
            setAddedPhotos(prev => {
                return [...prev, ...filenames]
            })
        })
    }
  return (
    <div>
        {action !== 'new' && (
            <div className='text-center'>
                <Link className='inline-flex gap-1 bg-primary text-white py-2 px-4 rounded-full' to={'/account/places/new'}>
                    Add new place
                </Link>
            </div>
        )}

        {action === 'new' && (
            <div>
                <form action="">
                    {preInput('Title', 'Fill your title')}
                    <input type='text' value={title}
                        onChange={ev => setTitle(ev.target.value)}
                        placeholder='Title'
                    />
                    
                    {preInput('Address', 'Fill your address')}
                    <input type='text' value={address}
                        onChange={ev => setAddress(ev.target.value)}
                        placeholder='Address'
                    />
                    
                    {preInput('Photos', 'Fill your photos')}
                    <div className='flex gap-2'>
                        <input type="text" value={photoLink}
                            onChange={ev => setPhotoLink(ev.target.value)}
                            placeholder='Add using a link...'
                        />
                        <button onClick={addPhotoByLink} className='bg-gray-200 px-4 rounded-2xl'>Add&nbsp;photo</button>
                    </div>
                    
                    <div className='mt-2 grid gap-2 grid-cols-3 md:grid-cols-4 lg:grid-cols-6'>
                        {addedPhotos.length >0 && addedPhotos.map(link => (
                            <div className='h-32 flex'>
                                <img className='rounded-2xl w-full object-cover' src={'http://localhost:4000/post/uploads/'+link} alt="" />
                            </div>
                        ))}
                        <label className='h-32 cursor-pointer flex items-center justify-center gap-1 border bg-transparent rounded-2xl p-2'>
                            <input type="file" multiple className='hidden' onChange={uploadPhoto}/>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                            </svg>
                            Upload
                        </label>
                    </div>

                    {preInput('Description', 'Fill your description')}
                    <textarea value={description} onChange={ev => setDescription(ev.target.value)}/>

                    {preInput('Perks', 'Fill your perks')}
                    <div className='grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6'>
                        <Perks selected={perks} onChange={setPerks}/>
                    </div>

                    {preInput('Extra info', 'Fill your extra info')}
                    <textarea value={extraInfo} onChange={ev => setExtraInfo(ev.target.value)} />

                    {preInput('Checkin, Checkout, Max guests', 'Fill the blank')}
                    <div className='grid gap-2 sm:grid-cols-3'>
                        <div>
                            <h3 className='mt-2 -mb-1'>Checkin time</h3>
                            <input type="text" value={checkIn}
                                onChange={ev => setCheckIn(ev.target.value)}
                                placeholder='14:00'
                            />
                        </div>
                        <div>
                            <h3 className='mt-2 -mb-1'>Checkout time</h3>
                            <input type="text" value={checkOut}
                                onChange={ev => setCheckOut(ev.target.value)}
                                placeholder='11:00'
                            />
                        </div>
                        <div>
                            <h3 className='mt-2 -mb-1'>Max guests</h3>
                            <input type="number" value={maxGuests}
                                onChange={ev => setMaxGuests(ev.target.value)}
                            />
                        </div>
                    </div>

                    <button className='primary my-4'>Save</button>
                </form>
            </div>
        )}
    </div>
  )
}

export default PlacesPage