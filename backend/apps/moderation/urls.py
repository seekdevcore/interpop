from django.urls import path
from .views import (
    BanDestroyView,
    BanListCreateView,
    BanRequestDecideView,
    BanRequestListCreateView,
)

urlpatterns = [
    path('moderation/bans/',                    BanListCreateView.as_view(),        name='ban-list'),
    path('moderation/bans/<uuid:pk>/',          BanDestroyView.as_view(),            name='ban-detail'),
    path('moderation/ban-requests/',            BanRequestListCreateView.as_view(),  name='ban-request-list'),
    path('moderation/ban-requests/<uuid:pk>/decide/', BanRequestDecideView.as_view(), name='ban-request-decide'),
]
