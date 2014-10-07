var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//Session

app.use(cookieParser('Shhhhhhkudhiyhdoiqadhyoiqyhdfoiqwydoiqwyd'));
app.use(session());

app.get('/',
function(req, res) {
  restrict(req,res,function(){
    res.render('index');
  });
});
//--------------------------
app.get('/signout',
function(req, res) {
  console.log('IT WORKSSSSSSS');
  req.session.destroy(function(){
        res.redirect('/');
    });
  // restrict(req,res,function(){
  //   res.render('index');
  // });
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;
  var _res = res;
  bcrypt.hash(password, null, null, function(err, hash) {
    // Store hash in your password DB.
    db.knex('users')
      .insert({
        name:username,
        password:hash
      }).then(function(){
        _res.redirect('/');
      });
  });

});

//---------------------------------------

app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/links',
function(req, res) {
  restrict(req,res,function(){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  })
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
function restrict(req, res, next) {
  // console.log(req.session.user);
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.post('/login', function(request, response) {

    var username = request.body.username;
    var password = request.body.password;
    console.log('request',username,password);
    // res == true
    db.knex('users').where({
      'name':username
    }).then(function(user){
        console.log('ssssssss',user);
        if(user.length > 0){
          bcrypt.compare(password, user[0].password, function(err, res) {
            if(res){
              request.session.regenerate(function(){
                request.session.user = username;
                response.redirect('/');
                console.log('Password Checked')
              });
            }else{
              console.log('Wrong password')
              response.redirect('/signup');
            }
          });

        }else{
          console.log('Could not find user')
        }
      })
});

app.get('/restricted', restrict, function(request, response){
  response.send('This is the restricted area! Hello ' + request.session.user + '! click <a href="/logout">here to logout</a>');
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
