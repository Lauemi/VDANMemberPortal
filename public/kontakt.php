<?php
header('content-type: text/html; charset=UTF-8');

$salut  = $_POST['salut'];
$lname  = $_POST ['name'] ;
$fname  = $_POST ['fname'] ;
$email  = $_POST ['email'] ;
$phone  = $_POST ['phone'] ;
$message= $_POST ['message'] ;


$an = '	mailbox-vdan@lauemi.de';
$betreff = 'Webformular-Nachricht';
$nachricht = "
    Nachricht über das Website-Kontaktformular:
        Absender: $salut $lname, $fname \n
        E-mail: $email \n
        Telefon: $phone \n\n
        Nachricht:\n 
        $message";



mail ($an, $betreff, $nachricht, "Form:" . $email);

echo 'Ihre Nachricht wurde erfolgreich gesendet. Sie werden
baldmöglichst eine Antwort erhalte ';

?>