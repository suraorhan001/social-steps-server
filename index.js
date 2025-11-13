require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");

const serviceAccount = require('./social-platforms-firebase-sdk.json');
const app = express()
const port = 3000
app.use(cors())
app.use(express.json())

//firebase-sdk

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//mongo connection


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zhtohyx.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middleware
const verifyToken = async (req,res,next)=>{
 //console.log('i am from middleware')
 const authorization = req.headers.authorization

 if(!authorization){
  return  res.status(401).send({
    message:'unauthorized access. '
  })
 }
  const token = authorization.split(" ")[1]
 
 try {
   await admin.auth().verifyIdToken(token)
     next()
 } catch (error) {
  res.status(401).send({
    message:'unauthorized access'
  })
 }
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
  
   const db = client.db('social-db')
   const socialStepsCollection = db.collection("socielsteps")
   const joinedCollection = db.collection('joined');

   // upcoming collections of api 

   app.get("/upcoming-social-steps", async (req, res) => {
  try {
    const { type, search } = req.query;
    const today = new Date(); // MongoDB Date type সঙ্গে তুলনা

    const filter = { eventDate: { $gte: today } }; // toISOString() সরানো

    if (type) filter.eventType = type;
    if (search) filter.eventTitle = { $regex: search, $options: "i" };

    const result = await socialStepsCollection.find(filter).toArray();

    res.send({ success: true, data: result });
  } catch (error) {
    console.error("Get Upcoming Events Error:", error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});



  
   //Get all joined events by a user
  
       app.get("/joined-events/:email",verifyToken, async (req, res) => {
    try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).send({ success: false, message: "Email is required" });
    }

    const result = await joinedCollection
      .find({ userEmail: email })
      .sort({ joinedAt: -1 })
      .toArray();

    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get Joined Events Error:", error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
   });

  /// get all the  cards created by currentuser

  app.get("/my-events/:email",verifyToken ,async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) return res.status(400).send({ success: false,
       message: "Email required" });

    const result = await socialStepsCollection.find({ createdBy: email }).toArray();

    res.send({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Get My Events Error:", error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});
// get single event by id
app.get("/upcoming-social-steps/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const event = await socialStepsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).send({ success: false, message: "Event not found" });
    }

    res.send({
      success: true,
      result: event,
    });
  } catch (error) {
    console.error("Get single event error:", error);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
});



   
  // event create korchi
  app.post('/upcoming-social-steps',verifyToken,async (req,res)=>{
    const data = req.body
    console.log(data)
    const result = await socialStepsCollection.insertOne(data)

    res.send({
      success:true,
      result
    })
  })


  //join event er maddome user er data post kore mongo te pathacchi
  
app.post("/join-event", async (req, res) => {
  try {
    const { userEmail, eventId, eventTitle, eventDate, location, thumbnail } = req.body;

    
    if (!userEmail || !eventId) {
      return res.status(400).send({ message: "Missing required fields" });
    }

   
    const existing = await joinedCollection.findOne({ userEmail, eventId });
    if (existing) {
      return res.status(409).send({ message: "Already joined this event" });
    }

 
    const joinInfo = {
      userEmail,
      eventId,
      eventTitle,
      eventDate,
      location,
      thumbnail,
      joinedAt: new Date(),
    };

    const result = await joinedCollection.insertOne(joinInfo);
    res.status(201).send({
      message: "Event joined successfully!",
      data: result,
    });
  } catch (error) {
    console.error("Join Event Error:", error);
    res.status(500).send({ message: "Internal server error" });
  }
   });
   //user nijer create kora event update korbe
    // user nijer create kora event update korbe
    app.put("/update-event/:id",verifyToken ,async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const objectId = new ObjectId(id);
    const filter = { _id: objectId };
    const update = { $set: data };

    const result = await socialStepsCollection.updateOne(filter, update);

    res.send({
      success: true,
      message: "Event updated successfully!",
      result,
    });
  } catch (error) {
    console.error("Update Event Error:", error);
    res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
  });



   //user nijer create kora event delete korbe

   app.delete('/delete-event/:id/:userEmail', async (req, res) => {
  try {
    const { id, userEmail } = req.params;

    // check if this event belongs to user
    const event = await socialStepsCollection.findOne({ _id: new ObjectId(id), createdBy: userEmail });
    if (!event) {
      return res.status(403).send({ success: false, message: "You can only delete your own events!" });
    }

    const result = await socialStepsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send({ success: true, message: "Event deleted successfully", data: result });
  } catch (err) {
    console.error("Delete Event Error:", err);
    res.status(500).send({ success: false, message: "Internal server error" });
  }
    });



    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})