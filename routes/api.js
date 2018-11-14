/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const mongoose = require('mongoose')
const fetch = require('node-fetch')

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});
mongoose.connect(CONNECTION_STRING)

let stockSchema = new mongoose.Schema({
  stock: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0,
    required: true
  },
  likedBy: {
    type: [String],
    default: [],
    required: true
  }
})
let Stock = mongoose.model('Stock', stockSchema)

const oneLikedStock = (singleStock, price, req, res) => {
  Stock.findOneAndUpdate(
    {stock: singleStock}, 
    {
      $inc: {likes: 1},
      $push: {likedBy: req.ip}
    }, 
    {upsert: true, new: true}, // create stock in DB if it doesn't exist
    (err, doc) => {
      res.json({stockData: {
        stock: singleStock,
        price,
        likes: doc.likes
      }})
    }
  )
}

const oneNotLikedStock = (singleStock, price, res) => {
  Stock.findOneAndUpdate( 
    {stock: singleStock}, 
    {$inc: {likes: 0}}, 
    {upsert: true},
    (err, doc) => {
      if (doc) {
        res.json({stockData: {
        stock: singleStock,
        price,
        likes: doc.likes
        }})
      } else {
        res.json({
          stockData: {
            stock: singleStock,
            price,
            likes: 0
          }
        })
      }
      
    }
  )
}

const twoStocks = (stock1, stock2, stock1Price, stock2Price, res) => {
  Stock.findOneAndUpdate(
    {stock: stock1},
    {$inc: {likes: 0}},
    {upsert: true},
    (err, doc1) => {
      let stock1Likes
      if (doc1) {
        stock1Likes = doc1.likes
      } else {
        stock1Likes = 0
      }
      Stock.findOneAndUpdate(
        {stock: stock2},
        {$inc: {likes: 0}},
        {upsert: true},
        (err, doc2) => {
          let stock2Likes
          if (doc2) {
            stock2Likes = doc2.likes
          } else {
            stock2Likes = 0
          }
          res.json({stockData:
            [
              {
                stock: stock1,
                price: stock1Price,
                rel_likes: stock1Likes - stock2Likes
              },
              {
                stock: stock2,
                price: stock2Price,
                rel_likes: stock2Likes - stock1Likes
              }
            ]
          })
        }
      )
    }
  )
}


module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(function (req, res){

      if (Array.isArray(req.query.stock)) { // passed 2 stocks
        let stock1 = req.query.stock[0]
        let stock2 = req.query.stock[1]
        fetch(`https://api.iextrading.com/1.0/stock/${stock1}/price`)
          .then((response) => {
            return response.json()
          }).then((stock1Price) => {
            fetch(`https://api.iextrading.com/1.0/stock/${stock2}/price`)
              .then((response) => {
                return response.json()
              }).then((stock2Price) => {
                if (req.query.like) {
                  Stock.findOne({stock: stock1}, (err, doc1) => {
                    if (!doc1.likedBy.includes(req.ip)) {
                      doc1.updateOne({$inc: {likes: 1}, $push: {likedBy: req.ip}}, (err, raw) => {

                      })
                    }
                    Stock.findOne({stock: stock2}, (err, doc2) => {
                      if (!doc2.likedBy.includes(req.ip)) {
                        doc2.updateOne({$inc: {likes: 1}, $push: {likedBy: req.ip}}, (err, raw) => {

                        })
                      }
                    })
                    twoStocks(stock1, stock2, stock1Price, stock2Price, res)
                  })
                } else {
                  twoStocks(stock1, stock2, stock1Price, stock2Price, res)
                }
              }).catch((error) => {
                res.json({error: 'stock not found'})
              })
          }).catch((err) => {
            res.json({error: 'stock not found'})
          })

      } else {  // passed 1 stock
        let singleStock = req.query.stock
        fetch(`https://api.iextrading.com/1.0/stock/${singleStock}/price`)
          .then((response) => {
            return response.json()
          }).then((price) => {
            if (req.query.like) {
              Stock.findOne({stock: singleStock}, (err, doc) => {
                if (doc.likedBy.includes(req.ip)) {
                  oneNotLikedStock(singleStock, price, res)
                } else {
                  oneLikedStock(singleStock, price, req, res)
                }
              })
            } else {
              oneNotLikedStock(singleStock, price, res)
            }
          }).catch((error) => {
            res.json({error: 'stock not found'})
          })
      }
    });
    
};



