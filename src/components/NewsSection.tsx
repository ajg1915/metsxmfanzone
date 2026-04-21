import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import springImage from "@/assets/spring-training.jpg";

const NewsSection = () => {
  const articles = [
    {
      id: 1,
      category: "PLAYER SPOTLIGHT",
      title: "Jeff McNeil's Fork in the Road: Trade Bait or Glue Guy?",
      excerpt: "Should the Mets shop Jeff McNeil this winter, or is he the quintessential glue guy?",
      date: "5 hours",
      image: springImage
    },
    {
      id: 2,
      category: "NEWS",
      title: "Showdown at Sienna Docks: Is Pete Alonso or Edwin Diaz the...",
      excerpt: "As free agent season is in full swing now that the World Series fans have turned their attention toward Mets' free agents.",
      date: "8 hours",
      image: springImage
    },
    {
      id: 3,
      category: "ANALYSIS",
      title: "Juan Soto's Championship Pedigree: They Strikler Filled as a...",
      excerpt: "The New York Mets will have their appointment with Juan Soto coming up soon. Analyst coach Roy Stribler on the team's new hitting.",
      date: "12 hours",
      image: springImage
    }
  ];

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-b from-secondary/20 to-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {articles.map((article, index) => (
            <Card 
              key={article.id} 
              className="border border-border/50 bg-gradient-to-br from-card to-secondary/20 overflow-hidden hover-glow transition-all duration-300 group cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="aspect-video overflow-hidden relative">
                <img 
                  src={article.image} 
                  alt={`${article.title} - New York Mets ${article.category.toLowerCase()} on MetsXMFanZone`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
              </div>
              <CardHeader className="relative">
                <Badge className="w-fit mb-2 bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                  {article.category}
                </Badge>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                  {article.title}
                </h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {article.excerpt}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 text-secondary" />
                  {article.date}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
