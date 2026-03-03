// Common English words (~3000) — enough to cover a young child's vocabulary.
// Words not in this set are treated as gibberish and highlighted.
const WORDS = new Set(`
a about above after again against all am an and any are as at be because been
before being below between both but by can could did do does doing down during
each few for from further get got had has have having he her here hers herself
him himself his how i if in into is it its itself just know let like make me
might more most my myself no nor not now of off on once only or other our ours
ourselves out over own put quite really right said same say she should so some
still such take tell than that the their theirs them themselves then there
these they this those through to too under until up us use used very want was
we well were what when where which while who whom why will with won would yes
yet you your yours yourself yourselves
able about above accept across act add afraid after afternoon again ago agree
air all almost along already also always am among an and angry animal answer
any appear apple are area arm around arrive art ask at away back bad bag ball
banana bank base basket bath be bear beat beautiful because bed been before
began begin behind believe below beside best better between big bird bit black
blood blue board boat body bone book born both bottom box boy brain bread break
bring brother brown build burn bus business busy but buy by cake call came can
cap car care carry cat catch caught center chair change child children choose
church city class clean clear climb close clothes cloud coat cold come common
complete contain cook cool corner could country course cover cross cry cup cut
dad dance danger dark daughter day dead dear deep desk did die different dinner
direction dirty discover do doctor does dog dollar done door down draw dream
dress drink drive drop dry during each ear early earth east eat egg eight
either else end enemy enjoy enough enter even evening ever every everyone
everything example except excited eye face fact fall family far farm fast fat
father feed feel feet fell few field fight fill finally find fine finger finish
fire first fish five flat floor fly follow food foot for force foreign forest
forever forget form found four free fresh friend from front fruit full fun
funny game garden gate gave get girl give glad glass go goat god gold gone good
got grade grass great green grew ground group grow guess gun guy had hair half
hall hand happen happy hard has hat have he head hear heart heavy held hello
help her here high hill him his hit hold hole home hope horse hospital hot
hotel house how huge hundred hungry hunt hurry hurt husband ice idea if
important in inside instead interest into iron is island it its job join joy
jump just keep key kid kill kind king kitchen knee knew knock know land large
last late laugh lay lead learn least leave left leg less let letter life light
like line lion lips listen little live long look lost lot loud love low luck
lunch machine made main make man many map mark market matter may me meal mean
meet men middle might mile milk million mind minute miss mistake mix mom moment
money monkey month moon more morning most mother mountain mouse mouth move
movie much music must my name near neck need never new news next nice night
nine no noise none north nose not note nothing now number ocean of off offer
office often oh oil old on once one only open or orange order other our out
outside over own page paint pair pan pants paper parent park part party pass
past pay pen people perfect perhaps period person pick picture piece pig place
plan plant play please point poor pop possible power pretty print probably
problem promise pull push put quarter queen question quick quiet quite rabbit
race rain ran reach read ready real reason red remember rest return rich ride
right ring rise river road rock roll room round run rush sad safe said salt
same sand sat save saw say school sea seat second see seem sell send sentence
serve set seven several shake shall shape share she ship shirt shoe shoot
short should shoulder shout show shut sick side sign since sing sister sit six
size sky sleep small smell smile smoke snow so some son song soon sorry sound
south space speak special speed spend spoke sport spring square stage stand
star start state stay step still stop store storm story strange street strong
student study such suddenly sugar summer sun sure surprise sweet swim table
take talk tall taste teach team tell ten test than thank that the their them
then there thick thin thing think third this though thought three through
throw tie till time tiny to today together told tomorrow too top touch toward
town train travel tree trouble truck true trust try turn twelve twenty two
type uncle under understand until up upon us use usual valley very visit voice
wait walk wall want war warm was wash watch water way we wear weather week well
went were west wet what wheel when where which while white who whole whose why
wide wife will win wind window winter wish with without woman wonder won wood
word work world worry would write wrong yard yeah year yellow yes yesterday you
young your zero zoo
able across actually after afternoon ago air already also always animal
another anything arm around ask asleep aunt awake away baby balloon bear bed
bedroom before behind belly beside between bicycle big birthday blanket block
blow board book bottle bottom boy breakfast bring broken brother brush bubble
bug building bump bunny bus butterfly button call candy careful carry catch
cereal chair change cheese chicken circle clap clean climb close cloud coat
cold color come cookie count cow crayon crazy cry cuddle cup cut daddy dance
dark day deep diaper dinosaur dirty dish doggy doll door down draw drink drop
dry duck ear eat egg elephant empty end enough every everybody everyone
everything eye face fall family farm fast favorite feel find finger fish fix
flower fly food foot fork friend frog fruit full funny game garden gentle get
giraffe girl give glass go gold good gorilla grandma grandpa grape grass green
grow hair hand happen happy hat head hear heart help here hide high hold home
honey hop hot house hug hungry hurry hurt inside jump kangaroo kick kind kiss
kitchen kitten knee lamp laugh leaf lemon letter lick light like lion little
live lizard look loud love lunch magnet make mama many match maybe mean mess
milk mine minute mirror mittens mommy monkey monster moon morning mouth music
nap need new nice night noise noodle nothing now number octopus open orange
outside owl paint pajama pancake papa park peanut penguin people phone picture
pillow pizza plant play please pocket point potato pretend princess puddle
pull puppy purple push puzzle rain rainbow read ready red rice ride ring rock
rocket roll roof room round run sad sand scared school scissors scooter shark
sheep shirt shoe silly sing sister sit skateboard sleep slide slow small
smell smile snack snake snow sock soft song spider spill spoon star step stick
stomach stone stop story strawberry string stuck sugar sun surprise swing
table teeth thank think thirsty throw tickle tiger toast today together
tomato tomorrow tongue tooth toothbrush towel toy train tree triangle truck
try tummy turkey turn turtle umbrella under unicorn up vegetable wait wake
walk warm wash water watermelon whale wheel whisper window wing wipe wish wolf
yellow yummy zebra zipper
`.trim().split(/\s+/).map(w => w.toLowerCase()));

export function isRealWord(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!cleaned) return true; // punctuation, numbers etc — don't flag
  if (cleaned.length <= 1) return true; // single letters are fine
  return WORDS.has(cleaned);
}
