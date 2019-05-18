var app = {
  initialize: function() {
    document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
  },
  onDeviceReady: function() {
    this.receivedEvent('deviceready');
    watchID = navigator.geolocation.watchPosition(geoSuccess, geoFail, {});  //enableHighAccuracy: true});
    var online;
    var stringEstacions = storage.getItem("estacions");
    map = L.map('map');
    if (checkConnection() == 'No network connection') {
      online = false;
      if(stringEstacions == null) {
        navigator.notification.alert("La configuració inicial de l'App precisa una connexió a Internet. Si us plau, reinicia l'App quan en tinguis.", tancar, "Sense connexió", "Tancar");        
      } else {
        navigator.notification.alert("No es pot connectar a Internet. Algunes característiques de l'App no estaran disponibles.", empty, "Sense connexió", "D'acord");
        map.setView([41.7292826, 1.8225154], 10);
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'json/municipis.geojson');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.responseType = 'json';
        xhr.onload = function() {
            return L.geoJSON(xhr.response,{style:{"color": "#0000FF","weight": 1,"opacity": 0.5}}).addTo(map);
        };
        xhr.send();
      }
    } else {
      online = true;
      map.setView([41.7292826, 1.8225154], 15);
      L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
        minZoom: 1,
        maxZoom: 19,
        attribution: 'Wikimedia'
      }).addTo(map);

    };
    db = window.openDatabase('Edumet', '', 'Base de dades Edumet', 10000);
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
      console.log('File system open: ' + fs.name);
      fileSystem = fs;
    }); 
    
    var ara = new Date();
    var dies = (ara - new Date(stringEstacions)) / 36000000;
    if((stringEstacions == null || dies > 30) && online) {
      baixaEstacions();
      baixaFenomens();
    } else {
      mostraEstacions();
      getFenomens();
    }
    document.addEventListener("backbutton", onBackKeyDown, false);
    window.addEventListener("orientationchange", function() {
      console.log(screen.orientation.type);
    });
    var input = document.getElementById('password');
    input.addEventListener("keyup", function(event) {
      if (event.keyCode === 13) {
        valida();
      }
    });
    window.addEventListener("orientationchange", function() {
      ajustaOrientacio(screen.orientation.angle);
    });
    if(window.innerHeight > window.innerWidth){
      ajustaOrientacio(0);
    }
  },
  receivedEvent: function(id) {
    var parentElement = document.getElementById(id);
    if(parentElement!=undefined) {
      var listeningElement = parentElement.querySelector('.listening');
      var receivedElement = parentElement.querySelector('.received');
      listeningElement.setAttribute('style', 'display:none;');
      receivedElement.setAttribute('style', 'display:block;');
      console.log('Received Event: ' + id);
    }
  }
};

var storage = window.localStorage;
var db;
var usuari = "";
var contrasenya;
var estacioActual;
var estacioPreferida;
var fenomens = [];
var latitudActual;
var longitudActual;
var url_servidor = "https://edumet.cat/edumet/meteo_proves/dades_recarregar.php";
var INEinicial = "081234";
var codiInicial = "08903085";
var localitzat = false;
var fotoBaixada;
var fileSystem;
var observacioActual = "";
var observacioFitxa;
var mapaFitxa;
var marcadorFitxa;
var vistaActual;
var vistaOrigen;
var obsActualitzades = false;
var marcador = [];
var watchID;
var estacioDesada = false;
var colorEdumet = "#418ac8";
var map;
var slideIndex;
var flagRadar = false;

app.initialize();

function empty() {  
}

function onBackKeyDown() {
  switch(vistaActual) {
    case 'fitxa':
      activa('observacions');
      break;
    case 'observacions':
      activa('fenologia');
      break
    case 'fotografia':
      activa(vistaOrigen);
      break;
    default:
      navigator.notification.confirm("Vols sortir de l'App eduMET?", sortir, "Sortir", ["Sortir","Cancel·lar"]);
  }
}

function ajustaOrientacio(angle) {
  var textBoto = '<i class="material-icons icona-24">';
  if(angle == 90 || angle == 270) {
    document.getElementById("boto_observacions").innerHTML = textBoto + 'camera_alt</i>';
    document.getElementById("boto_estacions").innerHTML = textBoto + 'router</i>';
    document.getElementById("boto_prediccio").innerHTML = textBoto + 'cloud</i>';
    document.getElementById("boto_radar").innerHTML = textBoto + 'rss_feed</i>';
    document.getElementById("radar_titol").innerHTML = "";
    document.getElementById('slideshow-container').style.width = "50%";
  } else {
    document.getElementById("boto_observacions").innerHTML = textBoto + 'camera_alt</i><br>Observa';
    document.getElementById("boto_estacions").innerHTML = textBoto + 'router</i><br>Estacions';
    document.getElementById("boto_prediccio").innerHTML = textBoto + 'cloud</i><br>Predicció';
    document.getElementById("boto_radar").innerHTML = textBoto + 'rss_feed</i><br>Radar';
    document.getElementById("radar_titol").innerHTML = "RADAR METEOROLÒGIC";
    document.getElementById('slideshow-container').style.width = "100%";
  }
}

function sortir(buttonIndex) {
  if(buttonIndex == 1) {
    tancar();
  }
}
function tancar() {
  navigator.geolocation.clearWatch(watchID);
  navigator.app.exitApp();
}

// FENOMENS FENOLOGICS

function baixaFenomens() {
  var url = url_servidor + "?tab=llistaFenoFenologics";
  fetch(url)
  .then(response => response.text())
  .then(response =>  JSON.parse(response))
  .then(response => {
    console.log("Fenomens: Baixats");
    var x = document.getElementById("fenomen");
    var option = document.createElement("option");
    option.text = "Tria el tipus de fenomen";
    option.value = "0";    
    x.add(option);
    for(i=0;i<response.length;i++){
      fenomens[i+1] = response[i];
      option = document.createElement("option");
      option.text = response[i]["Bloc_feno"] + ': ' + response[i]["Titol_feno"];
      option.value = response[i]["Id_feno"];
      x.add(option);
    }
    db.transaction(function (tx) {
      tx.executeSql('DROP TABLE IF EXISTS Fenomens'); 
      tx.executeSql('CREATE TABLE Fenomens (Id_feno, Bloc_feno, Titol_feno)');   
      for(i=0;i<response.length;i++){
        var query = 'INSERT INTO Fenomens (Id_feno, Bloc_feno, Titol_feno) VALUES ("';
        query += response[i]["Id_feno"] + '","';
        query += response[i]["Bloc_feno"] + '","';
        query += response[i]["Titol_feno"] + '")';
        tx.executeSql(query);    
      }
    });
  });
}

function getFenomens() {
  db.transaction(function (tx) {  
    var query = 'SELECT * FROM Fenomens'
    tx.executeSql(query, [], function(tx, results){
      assignaFenomens(results.rows);
    },
    empty);          
  });
}
function assignaFenomens(response) {
  fenomens = [];
  var x = document.getElementById("fenomen");
  var option = document.createElement("option");
  option.text = "Tria el tipus de fenomen";
  option.value = "0";
  x.add(option);  
  for(i=0;i<response.length;i++){
    fenomens[i+1] = response[i];
    option = document.createElement("option");
    option.text = response[i]["Bloc_feno"] + ': ' + response[i]["Titol_feno"];;
    option.value = response[i]["Id_feno"];
    x.add(option);
  }
}

// ESTACIONS METEOROLÒGIQUES

function baixaEstacions() {
  var url = url_servidor + "?tab=cnjEstApp&xarxaEst=D";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    console.log("Estacions: Baixades");  
    db.transaction(function (tx) {
      tx.executeSql('DROP TABLE IF EXISTS Estacions'); 
      tx.executeSql('CREATE TABLE Estacions (Id_estacio, Codi_estacio, Nom_centre, Poblacio, Latitud, Longitud, Altitud)');  
      for(i=0;i<response.length;i++){
        var query = 'INSERT INTO Estacions (Id_estacio, Codi_estacio, Nom_centre, Poblacio, Latitud, Longitud, Altitud) VALUES ("';
        query += response[i]["Id_estacio"] + '","';
        query += response[i]["Codi_estacio"] + '","';
        query += response[i]["Nom_centre"] + '","';
        query += response[i]["Poblacio"] + '","';
        query += response[i]["Latitud"] + '","';
        query += response[i]["Longitud"] + '","';
        query += response[i]["Altitud"] + '")';
        tx.executeSql(query);
      }
    });
    storage.setItem("estacions", new Date());  
    mostraEstacions();
  });
}

function mostraEstacions() {
  var x = document.getElementById("est_nom");
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Estacions'
    tx.executeSql(query, [], function(tx, results){
      for(i=0;i<results.rows.length;i++){
        marcador[i] = L.marker(new L.LatLng(results.rows[i]["Latitud"], results.rows[i]["Longitud"])).addTo(map);   
        marcador[i].i = i
        marcador[i].Codi_estacio = results.rows[i]["Codi_estacio"];
        marcador[i].on('click',function(e) {
          var x = document.getElementById("est_nom");
          x.value = this.Codi_estacio;
          mostra(this.Codi_estacio);
        });   
        var option = document.createElement("option");
        option.text = results.rows[i]["Nom_centre"];
        option.value = results.rows[i]["Codi_estacio"];
        x.add(option);      
      }
      preferida = storage.getItem("Codi_estacio");
      if (preferida == null) {
        estacioActual = codiInicial;
        estacioPreferida = codiInicial;
        console.log("Preferida (Per defecte): " + estacioPreferida);
      } else {
        estacioActual = preferida;
        estacioPreferida = preferida;
        console.log("Preferida (Desada): " + estacioPreferida);

        var query = 'SELECT * FROM Estacions WHERE Codi_estacio="' + estacioPreferida + '"';
        tx.executeSql(query, [], function(tx, results){
          document.getElementById("est_nom").value = results.rows[0]["Codi_estacio"];
        },
        empty);
      }
      mostraEstacio();
    },
    empty);          
  });
}
function mostra(Codi_estacio) {
  estacioActual = Codi_estacio;
  mostraEstacio();
}

function selectEstacio() {  
  estacioActual = document.getElementById("est_nom").value;
  mostraEstacio();
}

function mostraEstacio() {
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Estacions WHERE Codi_estacio="' + estacioActual + '"';
    tx.executeSql(query, [], function(tx, results){
      document.getElementById('est_poblacio').innerHTML = results.rows[0]["Poblacio"];
      document.getElementById('est_altitud').innerHTML = "Altitud: " + results.rows[0]["Altitud"] + " m";
      var URLlogo = "https://edumet.cat/edumet-data/" + results.rows[0]["Codi_estacio"] + "/estacio/profile1/imatges/fotocentre.jpg";
      if(checkConnection() != 'No network connection'){
        document.getElementById('est_logo').src = URLlogo;
        getMesures();
      }
      map.setView(new L.LatLng(results.rows[0]["Latitud"], results.rows[0]["Longitud"]));
    },
    empty);
  });
  var estrella = document.getElementById('star');
  if(estacioActual == estacioPreferida) {
    estrella.innerHTML = "star";
    estrella.style.color = "yellow";
  } else {
    estrella.innerHTML = "star_border";
    estrella.style.color = "lightgray";
  }
}

function desaPreferida() {
  estacioPreferida = document.getElementById("est_nom").value;
  console.log("Preferida (Triada): " + estacioPreferida);
  storage.setItem("Codi_estacio", estacioPreferida);  
  var estrella = document.getElementById('star');
  estrella.innerHTML = "star";
  estrella.style.color = "yellow";
}

function getMesures() {
  db.transaction(function (tx) {  
    var query = 'SELECT Codi_estacio FROM Estacions WHERE Codi_estacio="' + estacioActual + '"';
    tx.executeSql(query, [], function(tx, results){
      var Codi_estacio = results.rows[0]["Codi_estacio"];
      var url = url_servidor + "?tab=mobilApp&codEst=" + Codi_estacio;
      fetch(url)
      .then(response => response.text())
      .then(response => JSON.parse(response))
      .then(response => {     
        document.getElementById('temperatura').innerHTML = response[0]["Temp_ext_actual"]+ " ºC <label style='color:red'>" + response[0]["Temp_ext_max_avui"] + " ºC <label style='color:cyan'>" + response[0]["Temp_ext_min_avui"] + " ºC</label>";
        document.getElementById('humitat').innerHTML = response[0]["Hum_ext_actual"] + "%";
        document.getElementById('pressio').innerHTML = response[0]["Pres_actual"] + " HPa";
        document.getElementById('sunrise').innerHTML = response[0]["Sortida_sol"].slice(0,5);
        document.getElementById('sunset').innerHTML = response[0]["Posta_sol"].slice(0,5);
        document.getElementById('pluja').innerHTML = response[0]["Precip_acum_avui"] + " mm";
        document.getElementById('vent').innerHTML = response[0]["Vent_vel_actual"] + " Km/h";    
        INEinicial = response[0]["codi_INE"];
        var stringDataFoto = response[0]["Data_UTC"] + 'T' + response[0]["Hora_UTC"];
        var interval = (new Date() - new Date(stringDataFoto)) / 3600000;
        var textDataMesura = document.getElementById('data_mesura');
        textDataMesura.innerHTML = "Actualitzat a les " + response[0]["Hora_UTC"] + " del " + formatDate(response[0]["Data_UTC"]);
        if(interval < 2) {
          textDataMesura.style.color = "#006633";
        } else {
          textDataMesura.style.color = "#FF0000";
        }
      })
      .catch(reason => {
        textDataMesura.style.color = "#FF0000";
        textDataMesura.innerHTML = "L'estació no proporciona les dades ...";
        console.log("error:" + reason);
      });
    },
    empty);          
  });
}

// OBSERVACIONS

function baixaObsInicial() {
  var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
  fetch(url)
  .then(response => response.text())
  .then(response => JSON.parse(response))
  .then(response => {
    var numObs  = response.length;
    db.transaction(function (tx) {
      tx.executeSql('CREATE TABLE Observacions (ID, Data_observacio DATE, Hora_observacio TIME, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat)');   
      for(i=0;i<numObs;i++){
        var query = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
        query += response[i]["ID"] + '","';
        query += response[i]["Data_observacio"] + '","';
        query += response[i]["Hora_observacio"] + '","';
        query += response[i]["Latitud"] + '","';
        query += response[i]["Longitud"] + '","';
        query += response[i]["Id_feno"] + '","';
        query += response[i]["Descripcio_observacio"] + '","';
        query += response[i]["Fotografia_observacio"] + '","';
        query += '0' + '","';
        query += '1' + '")';   
        tx.executeSql(query);
        console.log("Observació inicial: " + response[i]["ID"]);
        baixaFoto(response[i]["ID"],response[i]["Fotografia_observacio"]); 
      }
    });
  });  
}

function baixaObsAfegides() {
  db.transaction(function (tx) {
    var query = 'SELECT ID FROM Observacions';
    tx.executeSql(query, [], function(tx, results){
      var url = url_servidor + "?usuari=" + usuari + "&tab=visuFenoApp";
      fetch(url)
      .then(response => response.text())
      .then(response => JSON.parse(response))
      .then(response => compara(results.rows,response));  
    },
    empty);
  });
}
function compara(local,remote){
  if(!(remote === null)){
    for(var i=0;i<remote.length;i++){
      var nova = true;
      for(var j=0;j<local.length;j++){
        if(local[j]["ID"] == remote[i]["ID"]){
          nova = false;
        }
      }
      if(nova){
        var query = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
        query += remote[i]["ID"] + '","';
        query += remote[i]["Data_observacio"] + '","';
        query += remote[i]["Hora_observacio"] + '","';
        query += remote[i]["Latitud"] + '","';
        query += remote[i]["Longitud"] + '","';
        query += remote[i]["Id_feno"] + '","';
        query += remote[i]["Descripcio_observacio"] + '","';
        query += remote[i]["Fotografia_observacio"] + '","';
        query += '0' + '","';
        query += '1' + '")';   
        console.log("Nova observació: " + remote[i]["ID"]);
        baixaFoto(remote[i]["ID"],remote[i]["Fotografia_observacio"]);
        db.transaction(function (tx) {          
          tx.executeSql(query);
        });
      }
    }
  }
}

function baixaFoto(id,foto) {
  fileSystem.root.getFile(foto, { create: true, exclusive: false }, function (fileEntry) {
    var url = 'https://edumet.cat/edumet/meteo_proves/imatges/fenologia/' + foto;
    fetch(url)
    .then(response => response.blob())
    .then(response => {
      var blob = new Blob([response], { type: 'image/jpeg' });
      writeFile(fileEntry, blob);
      db.transaction(function (tx) {
        var query = 'UPDATE Observacions SET Local_path="';
        query += fileEntry.toURL();;
        query += '" WHERE ID="';
        query += id;
        query += '"';
        tx.executeSql(query);
      });
    });        
  }, empty);
}
 
function writeFile(fileEntry, dataObj) {
  fileEntry.createWriter(function (fileWriter) {
    fileWriter.onwriteend = function() {
    };
    fileWriter.onerror = function (e) {
      console.log("Failed file write: " + e.toString());
    };
    fileWriter.write(dataObj);
  });
}

function enviaActual() {
  if(checkConnection() != 'No network connection'){
    enviaObservacio(observacioActual);
  } else {
    navigator.notification.alert("Opció no disponible sense connexió a Internet.", empty, "Penjar observació", "D'acord");
  }
}
function enviaFitxa() {
  if(checkConnection() != 'No network connection'){
    enviaObservacio(observacioFitxa);
  } else {
    navigator.notification.alert("Opció no disponible sense connexió a Internet.", empty, "Penjar observació", "D'acord");
  }
}

function enviaObservacio(path_observacio) {
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + path_observacio +'\'';   
    tx.executeSql(query, [], function(tx, rs){
      if(rs.rows.length == 0) {
        navigator.notification.alert("Si us plau, fes primer la foto corresponent a l'observació.", empty, "Penjar observació", "D'acord");
      } else {   
        var fitxaObs = rs.rows.item(0);
        var Id_feno = fitxaObs["Id_feno"];
        var Descripcio_observacio = fitxaObs["Descripcio_observacio"];
        if(Id_feno == "0" || Descripcio_observacio == "") {
          navigator.notification.alert("Si us plau, desa primer l'observació indicant el tipus de fenomen i escrivint una breu descripció.", empty, "Penjar observació", "D'acord");
        } else {
          if(fitxaObs["Enviat"] == "0") {
            window.resolveLocalFileSystemURL(fitxaObs["Local_path"], gotFile, fail);          
            function fail(e) {
              alert('Cannot found requested file');
            }
            function gotFile(fileEntry) {
              fileEntry.file(function(file) {
                var reader = new FileReader();
                reader.onload = function(e) {
                  var imatge64 = e.target.result.replace(/^data:image\/[a-z]+;base64,/, "");                
                  var envio = { tab: "salvarFenoApp",
                      usuari: usuari,
                      dia: fitxaObs["Data_observacio"],
                      hora: fitxaObs["Hora_observacio"],
                      lat: fitxaObs["Latitud"],
                      lon: fitxaObs["Longitud"],
                      id_feno: fitxaObs["Id_feno"],
                      descripcio: fitxaObs["Descripcio_observacio"],
                      fitxer: imatge64
                  }
                  var JSONenvio = JSON.stringify(envio);
                  fetch(url_servidor,{
                    method:'POST',
                    headers:{
                      'Content-Type': 'application/json; charset=UTF-8'
                      },
                    body: JSONenvio
                    })
                    .then(response => response.text())
                    .then(response => {   
                      db.transaction(function (tx) {
                        var query = 'UPDATE Observacions SET ID=';
                        query += response.trim();
                        query += ', Enviat=1';
                        query += ' WHERE Local_path="';
                        query += fitxaObs["Local_path"];
                        query += '"';
                        tx.executeSql(query, [], function(tx, results){
                          navigator.notification.alert("S'ha penjat l'observació al servidor eduMET.", empty, 'Penjar observació', "D'acord");
                          if(vistaActual == 'fitxa') {
                            document.getElementById('edita_obs').disabled = true;
                            document.getElementById('envia_obs').disabled = true;
                            var checkVerd = document.getElementById(fitxaObs["Local_path"]);
                            checkVerd.style.color = "limegreen";
                          }
                        },
                        empty);
                      });       
                    });
                };
                reader.readAsDataURL(file);
              });
            }
          } 
        }
      }     
    }, empty);    
  });  
}

function editaObservacio() {
  observacioActual = observacioFitxa;
  db.transaction(function (tx) {
    var query = 'SELECT Local_path,Id_feno,Descripcio_observacio FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
    tx.executeSql(query, [], function(tx, rs){
      var fitxaObs = rs.rows.item(0);
      var obs = document.getElementById('foto');
      obs.src = fitxaObs["Local_path"];
      var Id_feno = document.getElementById('fenomen');
      Id_feno.value = fitxaObs["Id_feno"];
      var Descripcio_observacio = document.getElementById('descripcio');
      if(fitxaObs["Descripcio_observacio"] == "Sense descriure"){
        Descripcio_observacio.value = "";
      } else {
        Descripcio_observacio.value = fitxaObs["Descripcio_observacio"];
      }
      activa('fenologia');
    });
  });
}

function eliminaObservacio() {
  navigator.notification.confirm("Vols eliminar aquesta observació?", eliminar, "Eliminar observació", ["Eliminar","Cancel·lar"]);
}
function eliminar(buttonIndex) {
  if(buttonIndex == 1) {
    elimina();
  }
}
function elimina() {
  db.transaction(function (tx) {    
    var query = 'SELECT ID,Enviat,Local_path FROM Observacions WHERE Local_path=\'' + observacioFitxa +'\'';   
    tx.executeSql(query, [], function(tx, rs){        
      var fitxaObs = rs.rows.item(0);
      var eliminarLocal = true;
      if(fitxaObs["Enviat"] == "1") {
        if (checkConnection() == 'No network connection') {
          navigator.notification.alert("Les observacions que ja s'han penjat al servidor eduMET no es poden eliminar sense connexió a Internet.", empty, 'Eliminar observació', "D'acord");
          eliminarLocal = false;
        } else {           
          var url = url_servidor + "?usuari=" + usuari + "&id=" + fitxaObs["ID"] + "&tab=eliminarFenUsu";
          fetch(url);
        }
      }
      if(eliminarLocal) {
        var query = 'DELETE FROM Observacions WHERE Local_path=\'' + observacioFitxa +'\'';
        tx.executeSql(query);
        window.resolveLocalFileSystemURL(fitxaObs["Local_path"], function success(fileEntry) {   
          fileEntry.remove(function(file){
            navigator.notification.alert("S'ha eliminat l'observació.", empty, 'Eliminar observació', "D'acord");
            if(observacioActual == observacioFitxa) {
              document.getElementById("foto").src = "img/add_photo.svg";
              document.getElementById("descripcio").value = "";
              document.getElementById("fenomen").value = "0";
              observacioActual = "";
            }
            activa('observacions');
            llistaObservacions();
          },function(error){
            console.log("error deleting the file " + error.code);
            });
          },function(){
            console.log("file does not exist");
          }
        );   
      }        
    }, empty);      
  });  
}

function actualitzaObservacio() {
  if(observacioActual == ""){
    navigator.notification.alert("Si us plau, fes primer la foto corresponent a l'observació.", empty, "Desar observació", "D'acord");
  } else {
    var Id_feno = document.getElementById('fenomen').value;
    var Descripcio_observacio = document.getElementById('descripcio').value;
    if(Id_feno == "0" || Descripcio_observacio == "") {
      navigator.notification.alert("Si us plau, tria primer el tipus de fenomen i escriu una breu descripció.", empty, 'Desar observació', "D'acord");
    } else {
      db.transaction(function (tx) {
        var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + observacioActual +'\'';
        tx.executeSql(query, [], function(tx, rs){  
          var fitxaObs = rs.rows.item(0);
          query = 'UPDATE Observacions SET Id_feno="';
          query += Id_feno;
          query += '", Descripcio_observacio="';
          query += Descripcio_observacio;
          query += '" WHERE Local_path="';
          query += fitxaObs["Local_path"];
          query += '"';
          tx.executeSql(query, [], function(tx, results){
            navigator.notification.alert("S'ha desat el tipus d'observació i la descripció del fenomen.", empty, 'Desar observació', "D'acord");
          },
          empty);           
        }, empty);    
      }); 
    }
  }
}

function llistaObservacions() {  
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions ORDER BY Data_observacio DESC, Hora_observacio DESC';
    tx.executeSql(query, [], function(tx, rs){
      var llista='';
      for(var i=0; i<rs.rows.length; i++) {
        var obsLlista = rs.rows.item(i);
        llista+= '<div style="display:flex; align-items:center;" onClick="fitxa(\'' + obsLlista["Local_path"] +'\')">';
        llista+= '<div style="width:25%"><img src="' + obsLlista["Local_path"] + '" style="width:10vh; height:10vh" /></div>';
        llista+= '<label style="width:25%">' + formatDate(obsLlista["Data_observacio"]) + '<br>' + obsLlista["Hora_observacio"] +'</label>';
        if(obsLlista["Id_feno"]!="0") {
          llista+= '<label style="width:25%">' + fenomens[obsLlista["Id_feno"]]["Titol_feno"] + '</label>';
        } else {
          llista+= '<label style="width:25%">' + "Sense identificar" + '</label>';
        }
        llista+= '<div style="width:25%">';
        if(obsLlista["Enviat"] == "1") {
          llista+= '<i id="' + obsLlista["Local_path"] + '" class="material-icons icona-36" style="color:limegreen">check</i>';
        } else {
          llista+= '<i id="' + obsLlista["Local_path"] + '" class="material-icons icona-36" style="color:lightgray">check</i>';
        }
        llista+= '</div></div>';        
      }
      document.getElementById('llistat').innerHTML = llista;
    }, empty) 
  });
}

function desaObservacio(entry){  
  var ara = new Date(Date.now());
  var any = ara.getFullYear();
  var mes = ara.getMonth() + 1;
  var dia = ara.getDate();
  var hora = ara.getHours();
  var minut = ara.getMinutes();
  var segon = ara.getSeconds();
  mes = mes.toString();
  dia = dia.toString();
  if (mes.length < 2) mes = '0' + mes;
  if (dia.length < 2) dia = '0' + dia;
  var Data_observacio = any + '-' + mes + '-' + dia;
  var Hora_observacio = hora + ':' + minut + ':' + segon;

  observacioActual = entry.toURL();
  var query = 'INSERT INTO Observacions (ID, Data_observacio, Hora_observacio, Latitud, Longitud, Id_feno, Descripcio_observacio, Fotografia_observacio, Local_path, Enviat) VALUES ("';
  query += '0' + '","';
  query += Data_observacio + '","';
  query += Hora_observacio + '","';
  query += latitudActual + '","';
  query += longitudActual + '","';
  query += '0' + '","';
  query += 'Sense descriure' + '","';
  query += '0' + '","';
  query += observacioActual + '","';
  query += '0' + '")';
  db.transaction(function (tx) {
    tx.executeSql(query);
  });
}

function activa(fragment) {
  flagRadar = false;
  document.getElementById('fenologia').style.display='none';
  document.getElementById('estacions').style.display='none';
  document.getElementById('radar').style.display='none';
  document.getElementById('prediccio').style.display='none';
  document.getElementById('observacions').style.display='none';
  document.getElementById('fitxa').style.display='none';
  document.getElementById('login').style.display='none';
  document.getElementById('fotografia').style.display='none';
  document.getElementById(fragment).style.display='flex';
  var boto = document.getElementById("boto_estacions");
  boto.style.color = "graytext";
  var boto = document.getElementById("boto_observacions");
  boto.style.color = "graytext";
  var boto = document.getElementById("boto_prediccio");
  boto.style.color = "graytext";
  var boto = document.getElementById("boto_radar");
  boto.style.color = "graytext";
  switch (fragment) {
    case "estacions":
      boto = document.getElementById("boto_estacions");
      break;
    case "login":
    case "fenologia":
    case "observacions":
    case "fitxa":
    case "fotografia":
      boto = document.getElementById("boto_observacions");
      break;
    case "prediccio":
      boto = document.getElementById("boto_prediccio");
      break;
    case "radar":
      boto = document.getElementById("boto_radar");
      break;
    default:
      break;
  }
boto.style.color = colorEdumet;  
vistaActual = fragment;
}

function login() {
  if (usuari == "") {
    usuari = storage.getItem("user");
  }
  if (usuari == null) {
    if (checkConnection() != 'No network connection') {
      activa('login');
    } else {
      navigator.notification.alert("Per iniciar sessió al servidor eduMET, veure les teves observacions o penjar-ne de noves, has d'estar connectat a Internet.", estacio, "Sense connexió", "D'acord");          
    }
  }
  else {
    fenologia();
  }
}
function fenologia() {
  activa('fenologia');
  if(!obsActualitzades && (checkConnection() != 'No network connection')) {
    baixaObsAfegides();
    obsActualitzades =  true;
  }
}
function estacio() {
  activa('estacions');
}
function radar() {
  if(checkConnection() != 'No network connection') {
    activa('radar');
    //document.getElementById('frameRadar').src = "https://edumet.cat/edumet/meteo_proves/00_radar_app.php";//
    //document.getElementById('frameRadar').src = "http://m.meteo.cat/temps-actual";
    var url = url_servidor + "?tab=radar";
    fetch(url)
    .then(response => response.text())
    .then(response =>  JSON.parse(response))
    .then(response => {
      var stringDiv ='';
      for(i=0;i<response.length;i++) {
        stringDiv+='<div class="mySlides"><img src="https://edumet.cat/edumet-data/meteocat/radar/';
        stringDiv+= response[i];
        stringDiv+='" style="width:100%"></div>';
      }
      document.getElementById('slideshow-container').innerHTML = stringDiv;
      stringDiv ='';
      for(i=0;i<response.length;i++) {
        stringDiv+='<span class="dot"></span>';
      }
      document.getElementById('puntets').innerHTML = stringDiv;
      slideIndex = 0;
      flagRadar = true;
      showSlides();    
    });
  } else {
    navigator.notification.alert("Opció no disponible sense connexió a Internet.", empty, "Radar meteorològic", "D'acord");
  }
}
function showSlides() {
  var slides = document.getElementsByClassName("mySlides");
  var dots = document.getElementsByClassName("dot");
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  slideIndex++;
  if (slideIndex > slides.length) {slideIndex = 1}    
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[slideIndex-1].style.display = "block";  
  dots[slideIndex-1].className += " active";
  if(flagRadar) {
    setTimeout(showSlides, 1000); // Change image every second
  }
}

function prediccio() {
  if(checkConnection() != 'No network connection') {
    activa('prediccio');
    var frame = document.getElementById('frame');
    var loader = document.getElementById('loaderPrediccio');
    loader.style.animationPlayState = "running";
    frame.onload = function() {
      loader.style.animationPlayState = "paused";
      loader.style.display = "none";
      frame.style.display = "flex";
    }
    frame.src = "http://m.meteo.cat/?codi=" + INEinicial;
  } else {
    navigator.notification.alert("Opció no disponible sense connexió a Internet.", empty, "Predicció meteorològica", "D'acord");
  }
}
function observa() {
  activa('observacions');
  llistaObservacions();
}
function fotografia() {
  var veureFoto = true;
  if((vistaActual == 'fenologia') && (observacioActual == "")) {
    veureFoto = false;
    fesFoto();
  } 
  if(veureFoto) {  
    vistaOrigen = vistaActual;
    activa('fotografia');
    if(vistaOrigen == 'fenologia') {
      document.getElementById('fotoGran').src = document.getElementById('foto').src;
    } else {
      document.getElementById('fotoGran').src = document.getElementById('fotoFitxa').src;
    }
  }
}

function fitxa(id) {
  observacioFitxa = id;
  activa('fitxa');
  db.transaction(function (tx) {
    var query = 'SELECT * FROM Observacions WHERE Local_path=\'' + observacioFitxa +'\'';    
    tx.executeSql(query, [], function(tx, rs){   
      var fitxaObs = rs.rows.item(0);
      var boto_edicio = document.getElementById('edita_obs');
      var boto_upload = document.getElementById('envia_obs');
      if(fitxaObs["Enviat"] == "1") {
        boto_edicio.style.color = "graytext";
        boto_upload.style.color = "graytext";
        boto_edicio.disabled = true;
        boto_upload.disabled = true;
      } else {
        boto_edicio.style.color = colorEdumet;
        boto_upload.style.color = colorEdumet;
        boto_edicio.disabled = false;
        boto_upload.disabled = false;
      }
      var nomFenomen = document.getElementById('nomFenomen');
      if(fitxaObs["Id_feno"] != "0") {
        nomFenomen.innerHTML = fenomens[fitxaObs["Id_feno"]]["Bloc_feno"] + ': ' + fenomens[fitxaObs["Id_feno"]]["Titol_feno"];
      } else {
        nomFenomen.innerHTML = "Sense identificar";
      }
      var dataHora = document.getElementById('dataHora');
      dataHora.innerHTML = formatDate(fitxaObs["Data_observacio"]) + '  -  ' + fitxaObs["Hora_observacio"];
      var fotoFitxa = document.getElementById('fotoFitxa');
      fotoFitxa.src = fitxaObs["Local_path"];
      var descripcioFitxaFitxa = document.getElementById('descripcioFitxa');
      descripcioFitxaFitxa.innerHTML = fitxaObs["Descripcio_observacio"];
      if(checkConnection() != 'No network connection') {
        var online = true;
      } else {
        var online = false;
      }
      try {
        mapaFitxa = L.map('mapaFitxa'); //,{attributionControl:false});
        if(online){
          mapaFitxa.setView(new L.LatLng(fitxaObs["Latitud"], fitxaObs["Longitud"]), 15);
          L.tileLayer('https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png', {
            minZoom: 1,
            maxZoom: 19,
            attribution: 'Wikimedia'
          }).addTo(mapaFitxa);
        } else{
          mapaFitxa.setView(new L.LatLng(fitxaObs["Latitud"], fitxaObs["Longitud"]), 10);
          const xhr = new XMLHttpRequest();
          xhr.open('GET', 'json/municipis.geojson');
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.responseType = 'json';
          xhr.onload = function() {
              return L.geoJSON(xhr.response,{style:{"color": "#0000FF","weight": 1,"opacity": 0.5}}).addTo(mapaFitxa);
          };
          xhr.send();
        }
      } catch {
        if(online){
          var zoom = 15;
        } else {
          var zoom = 10;
        }
        mapaFitxa.setView(new L.LatLng(fitxaObs["Latitud"],fitxaObs["Longitud"]), zoom);
        mapaFitxa.removeLayer(marcadorFitxa);
      }
      marcadorFitxa = L.marker(new L.LatLng(fitxaObs["Latitud"],fitxaObs["Longitud"]));
      marcadorFitxa.addTo(mapaFitxa);
    }, empty);    
  });
}

function valida() {
  usuari = document.getElementById('usuari').value;
  contrasenya = document.getElementById('password').value;
  var url = url_servidor + "?ident=" + usuari + "&psw=" + contrasenya + "&tab=registrar_se"
  fetch(url)
  .then(response => response.text())
  .then(response => response.trim())
  .then(response => {
    if (response == "") {
      console.log("No Auth");
      usuari = "";
      navigator.notification.alert("Usuari i/o contrasenya incorrectes. Si us plau, torna-ho a provar.", empty, "Identificació", "D'acord");
    } else {
      console.log("Auth OK " + usuari);
      storage.setItem("user", usuari);
      baixaObsInicial();
      activa('fenologia');
    }
  });
}

function geoFail() {
  console.log("GeoFail");
}

function geoSuccess(position){
  latitudActual = position.coords.latitude;
  longitudActual = position.coords.longitude;

  if(!estacioDesada) {
    var estPreferida = storage.getItem("Codi_estacio");
    if (estPreferida == null) {
      var distanciaPropera = 1000;
      var distanciaProva;
      var estacioPropera = 0;
      db.transaction(function (tx) {  
        var query = 'SELECT * FROM Estacions'
        tx.executeSql(query, [], function(tx, results){
          console.log("numEstacions:" + results.rows.length);
          for(i=0;i<results.rows.length;i++){
            distanciaProva = getDistanceFromLatLonInKm(latitudActual, longitudActual, results.rows[i]["Latitud"], results.rows[i]["Longitud"]);
            if(distanciaProva < distanciaPropera) {
              distanciaPropera = distanciaProva;
              estacioPropera = i;
            }
          }
          console.log("Preferida (Propera): " + results.rows[estacioPropera]["Codi_estacio"] + " : " + results.rows[estacioPropera]["Nom_centre"]);
          estacioActual = results.rows[estacioPropera]["Codi_estacio"];
          estacioPreferida = estacioActual;
          storage.setItem("Codi_estacio", estacioPreferida);
          estacioDesada = true;
          document.getElementById("est_nom").value = estacioPreferida;
          mostraEstacio();      
      },
      empty);          
      });
    }
  }

  if(!localitzat) {
    localitzat = true; 
    console.log("GeoSuccess: " + latitudActual + ", " + longitudActual);
    var greenIcon = L.icon({
      iconUrl: 'img/marker-icon-green.png',
      iconAnchor: [12, 41],
      shadowUrl: 'assets/leaflet/images/marker-shadow.png',
    });
    L.marker(new L.LatLng(latitudActual, longitudActual),{icon: greenIcon}).addTo(map);
  }
} 

function fesFoto() {
  if(localitzat) {
    var options = {
      quality: 20, // Some common settings are 20, 50, and 100
      destinationType: Camera.DestinationType.FILE_URI,
      targetHeight:800,
      targetWidth:800,
      sourceType: Camera.PictureSourceType.CAMERA,
      encodingType: Camera.EncodingType.JPEG,
      mediaType: Camera.MediaType.PICTURE,
      correctOrientation: true
    }
    navigator.camera.getPicture(onSuccess, onFail, options);  
    function onSuccess(imageURI) {
      var obs = document.getElementById('foto');
      obs.src = imageURI;
      document.getElementById("fenomen").value = "0";
      document.getElementById("descripcio").value = "";
      window.resolveLocalFileSystemURL(imageURI, function success(fileEntry) {   
        fileEntry.copyTo(fileSystem.root,"", desaObservacio, empty);       
      }, empty);    
    }  
    function onFail(message) {
      navigator.notification.alert("No s'ha pogut fer la foto.", empty, "Càmera", "D'acord");
    }
  }
  else {
    navigator.notification.alert("No es coneix la ubicació. Si us plau, activa primer GPS.", empty, "GPS", "D'acord");
  }
}

function checkConnection() {
  var networkState = navigator.connection.type;
  var states = {};
  states[Connection.UNKNOWN]  = 'Unknown connection';
  states[Connection.ETHERNET] = 'Ethernet connection';
  states[Connection.WIFI]     = 'WiFi connection';
  states[Connection.CELL_2G]  = 'Cell 2G connection';
  states[Connection.CELL_3G]  = 'Cell 3G connection';
  states[Connection.CELL_4G]  = 'Cell 4G connection';
  states[Connection.CELL]     = 'Cell generic connection';
  states[Connection.NONE]     = 'No network connection';
  //console.log('Connection type: ' + states[networkState]);
  return states[networkState];
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}
function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function getFileContentAsBase64(path,callback){
  window.resolveLocalFileSystemURL(path, gotFile, fail);          
  function fail(e) {
    console.log('Could not found requested file');
  }
  function gotFile(fileEntry) {
    fileEntry.file(function(file) {
      var reader = new FileReader();
      reader.onloadend = function(e) {
            var content = this.result;
            callback(content);
      };
      reader.readAsDataURL(file);
    });
  }
}

function formatDate(dia) {
  if(dia.indexOf(":") == -1) {
    var parts = dia.split('-');
  } else {
    var parts = dia.split(':');
  }
  var d = new Date(parts[0], parts[1] - 1, parts[2]); 
  month = '' + (d.getMonth() + 1);
  day = '' + d.getDate();
  year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [day, month, year].join('-');
}